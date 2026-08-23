import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "./config";
import { calculateScore, getEffectiveWeight, isoWeekKey } from "./domain";
import { db } from "./firebase";
import { resolveHouseholdPlanInTransaction } from "./plans";
import {
  enforceRateLimit,
  handleCallableError,
  operationDocumentId,
  requireActiveMembershipInTransaction,
  requireCaller,
} from "./security";
import {
  firestoreId,
  integer,
  requiredString,
  strictRecord,
  taskCategory,
  uuidV4,
} from "./validation";

function requireMemberCount(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new HttpsError("internal", "Composition du foyer invalide.");
  }
  return value as number;
}

export const createTaskTemplate = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 30,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, [
        "householdId",
        "name",
        "category",
        "weight",
        "idempotencyKey",
      ]);
      const householdId = firestoreId(input, "householdId");
      const name = requiredString(input, "name", 1, 100);
      const category = taskCategory(input, "category");
      const configuredWeight = integer(input, "weight", 1, 1000);
      const idempotencyKey = uuidV4(input, "idempotencyKey");

      await enforceRateLimit(caller.uid, "createTaskTemplate", 30, 3600);

      const templateReference = db
        .doc(`households/${householdId}`)
        .collection("taskTemplates")
        .doc();
      const operationReference = db.doc(
        `operationKeys/${operationDocumentId(caller.uid, "createTaskTemplate", idempotencyKey)}`,
      );
      const now = Timestamp.now();

      const result = await db.runTransaction(async (transaction) => {
        const operationSnapshot = await transaction.get(operationReference);
        const householdReference = db.doc(`households/${householdId}`);
        const householdSnapshot = await transaction.get(householdReference);
        await requireActiveMembershipInTransaction(
          transaction,
          caller.uid,
          householdId,
          ["owner", "admin"],
        );
        if (!householdSnapshot.exists) {
          throw new HttpsError("not-found", "Foyer introuvable.");
        }
        const memberCount = requireMemberCount(householdSnapshot.data()?.memberCount);
        const resolution = await resolveHouseholdPlanInTransaction(
          transaction,
          householdId,
          memberCount,
          now.toMillis(),
        );

        if (operationSnapshot.exists) {
          const existingId = operationSnapshot.data()?.resourceId;
          const existingPlan = operationSnapshot.data()?.plan;
          if (
            typeof existingId !== "string" ||
            !["trial", "free", "standard", "pro"].includes(existingPlan)
          ) {
            throw new Error("INVALID_IDEMPOTENCY_RECORD");
          }
          return { templateId: existingId, plan: existingPlan as typeof resolution.plan };
        }

        if (resolution.plan === "free" && configuredWeight !== 1) {
          throw new HttpsError(
            "failed-precondition",
            "La pondération personnalisée requiert un essai actif ou un abonnement.",
          );
        }

        transaction.create(templateReference, {
          name,
          category,
          configuredWeight,
          archived: false,
          createdBy: caller.uid,
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(operationReference, {
          uid: caller.uid,
          action: "createTaskTemplate",
          resourceId: templateReference.id,
          plan: resolution.plan,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 86_400_000),
        });
        return { templateId: templateReference.id, plan: resolution.plan };
      });

      return result;
    } catch (error) {
      return handleCallableError(error, "createTaskTemplate");
    }
  },
);

export const createTask = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 60,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, [
        "householdId",
        "templateId",
        "idempotencyKey",
      ]);
      const householdId = firestoreId(input, "householdId");
      const templateId = firestoreId(input, "templateId");
      const idempotencyKey = uuidV4(input, "idempotencyKey");

      await enforceRateLimit(caller.uid, "createTask", 120, 3600);

      const householdReference = db.doc(`households/${householdId}`);
      const templateReference = householdReference.collection("taskTemplates").doc(templateId);
      const taskReference = householdReference.collection("tasks").doc();
      const operationReference = db.doc(
        `operationKeys/${operationDocumentId(caller.uid, "createTask", idempotencyKey)}`,
      );
      const now = Timestamp.now();

      const result = await db.runTransaction(async (transaction) => {
        const operationSnapshot = await transaction.get(operationReference);
        const householdSnapshot = await transaction.get(householdReference);
        const templateSnapshot = await transaction.get(templateReference);
        await requireActiveMembershipInTransaction(transaction, caller.uid, householdId);

        if (!householdSnapshot.exists || !templateSnapshot.exists) {
          throw new HttpsError("not-found", "Foyer ou modèle de tâche introuvable.");
        }
        const householdData = householdSnapshot.data();
        const memberCount = requireMemberCount(householdData?.memberCount);
        const resolution = await resolveHouseholdPlanInTransaction(
          transaction,
          householdId,
          memberCount,
          now.toMillis(),
        );

        if (operationSnapshot.exists) {
          const existingId = operationSnapshot.data()?.resourceId;
          const existingPlan = operationSnapshot.data()?.plan;
          const existingStartedAt = operationSnapshot.data()?.startedAt;
          if (
            typeof existingId !== "string" ||
            !["trial", "free", "standard", "pro"].includes(existingPlan) ||
            !(existingStartedAt instanceof Timestamp)
          ) {
            throw new Error("INVALID_IDEMPOTENCY_RECORD");
          }
          return {
            taskId: existingId,
            plan: existingPlan as typeof resolution.plan,
            status: "in_progress" as const,
            startedAt: existingStartedAt.toDate().toISOString(),
          };
        }

        const templateData = templateSnapshot.data();
        if (templateData?.archived === true) {
          throw new HttpsError("failed-precondition", "Ce modèle de tâche est archivé.");
        }
        const templateName = requiredString({ name: templateData?.name }, "name", 1, 100);
        const category = taskCategory({ category: templateData?.category }, "category");
        const configuredWeight = integer(
          { weight: templateData?.configuredWeight },
          "weight",
          1,
          1000,
        );
        const effectiveWeight = getEffectiveWeight(resolution.plan, configuredWeight);
        const householdTimeZone = requiredString(
          { timezone: householdData?.timezone },
          "timezone",
          1,
          64,
        );

        transaction.create(taskReference, {
          householdId,
          userId: caller.uid,
          status: "in_progress",
          startTime: now,
          endTime: null,
          durationSeconds: null,
          score: null,
          weekKey: isoWeekKey(now.toDate(), householdTimeZone),
          templateSnapshot: {
            templateId,
            name: templateName,
            category,
            configuredWeight,
            effectiveWeight,
            plan: resolution.plan,
          },
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(operationReference, {
          uid: caller.uid,
          action: "createTask",
          resourceId: taskReference.id,
          plan: resolution.plan,
          startedAt: now,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 86_400_000),
        });
        return {
          taskId: taskReference.id,
          plan: resolution.plan,
          status: "in_progress" as const,
          startedAt: now.toDate().toISOString(),
        };
      });

      return result;
    } catch (error) {
      return handleCallableError(error, "createTask");
    }
  },
);

export const completeTask = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 60,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, [
        "householdId",
        "taskId",
        "idempotencyKey",
      ]);
      const householdId = firestoreId(input, "householdId");
      const taskId = firestoreId(input, "taskId");
      const idempotencyKey = uuidV4(input, "idempotencyKey");

      await enforceRateLimit(caller.uid, "completeTask", 120, 3600);

      const taskReference = db.doc(`households/${householdId}/tasks/${taskId}`);
      const operationReference = db.doc(
        `operationKeys/${operationDocumentId(caller.uid, "completeTask", idempotencyKey)}`,
      );
      const now = Timestamp.now();

      const result = await db.runTransaction(async (transaction) => {
        const operationSnapshot = await transaction.get(operationReference);
        const taskSnapshot = await transaction.get(taskReference);
        await requireActiveMembershipInTransaction(transaction, caller.uid, householdId);

        if (operationSnapshot.exists) {
          const operationData = operationSnapshot.data();
          if (
            operationData?.resourceId !== taskId ||
            typeof operationData.durationSeconds !== "number" ||
            typeof operationData.score !== "number"
          ) {
            throw new Error("INVALID_IDEMPOTENCY_RECORD");
          }
          return {
            taskId,
            durationSeconds: operationData.durationSeconds,
            score: operationData.score,
          };
        }

        if (!taskSnapshot.exists) {
          throw new HttpsError("not-found", "Tâche introuvable.");
        }
        const taskData = taskSnapshot.data();
        if (taskData === undefined) {
          throw new HttpsError("internal", "Données de tâche indisponibles.");
        }
        if (taskData.userId !== caller.uid) {
          throw new HttpsError("permission-denied", "Cette tâche appartient à un autre membre.");
        }
        if (taskData.status !== "in_progress" || !(taskData.startTime instanceof Timestamp)) {
          throw new HttpsError("failed-precondition", "Cette tâche ne peut pas être terminée.");
        }
        const snapshot = taskData.templateSnapshot;
        const effectiveWeight = integer(
          { weight: snapshot?.effectiveWeight },
          "weight",
          1,
          1000,
        );
        const elapsedSeconds = Math.max(
          1,
          Math.floor((now.toMillis() - taskData.startTime.toMillis()) / 1000),
        );
        if (elapsedSeconds > 86_400) {
          throw new HttpsError(
            "failed-precondition",
            "Une tâche ne peut pas dépasser 24 heures. Démarrez une nouvelle tâche.",
          );
        }
        const score = calculateScore(elapsedSeconds, effectiveWeight);

        transaction.update(taskReference, {
          status: "completed",
          endTime: now,
          durationSeconds: elapsedSeconds,
          score,
          updatedAt: now,
        });
        transaction.create(operationReference, {
          uid: caller.uid,
          action: "completeTask",
          resourceId: taskId,
          durationSeconds: elapsedSeconds,
          score,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 86_400_000),
        });
        return { taskId, durationSeconds: elapsedSeconds, score };
      });

      return { ...result, status: "completed" as const };
    } catch (error) {
      return handleCallableError(error, "completeTask");
    }
  },
);

export const createManualTask = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 60,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, [
        "householdId",
        "templateId",
        "durationMinutes",
        "idempotencyKey",
      ]);
      const householdId = firestoreId(input, "householdId");
      const templateId = firestoreId(input, "templateId");
      const durationMinutes = integer(input, "durationMinutes", 1, 1440);
      const durationSeconds = durationMinutes * 60;
      const idempotencyKey = uuidV4(input, "idempotencyKey");

      await enforceRateLimit(caller.uid, "createManualTask", 120, 3600);

      const householdReference = db.doc(`households/${householdId}`);
      const templateReference = householdReference.collection("taskTemplates").doc(templateId);
      const taskReference = householdReference.collection("tasks").doc();
      const operationReference = db.doc(
        `operationKeys/${operationDocumentId(caller.uid, "createManualTask", idempotencyKey)}`,
      );
      const now = Timestamp.now();

      const result = await db.runTransaction(async (transaction) => {
        const operationSnapshot = await transaction.get(operationReference);
        const householdSnapshot = await transaction.get(householdReference);
        const templateSnapshot = await transaction.get(templateReference);
        await requireActiveMembershipInTransaction(transaction, caller.uid, householdId);

        if (!householdSnapshot.exists || !templateSnapshot.exists) {
          throw new HttpsError("not-found", "Foyer ou modèle de tâche introuvable.");
        }
        const householdData = householdSnapshot.data();
        const currentMemberCount = requireMemberCount(householdData?.memberCount);
        const resolution = await resolveHouseholdPlanInTransaction(
          transaction,
          householdId,
          currentMemberCount,
          now.toMillis(),
        );

        if (operationSnapshot.exists) {
          const operationData = operationSnapshot.data();
          if (
            typeof operationData?.resourceId !== "string" ||
            typeof operationData.score !== "number" ||
            typeof operationData.durationSeconds !== "number" ||
            !(operationData.completedAt instanceof Timestamp)
          ) {
            throw new Error("INVALID_IDEMPOTENCY_RECORD");
          }
          return {
            taskId: operationData.resourceId,
            durationSeconds: operationData.durationSeconds,
            score: operationData.score,
            status: "completed" as const,
            completedAt: operationData.completedAt.toDate().toISOString(),
          };
        }

        const templateData = templateSnapshot.data();
        if (templateData?.archived === true) {
          throw new HttpsError("failed-precondition", "Ce modèle de tâche est archivé.");
        }
        const templateName = requiredString({ name: templateData?.name }, "name", 1, 100);
        const category = taskCategory({ category: templateData?.category }, "category");
        const configuredWeight = integer(
          { weight: templateData?.configuredWeight },
          "weight",
          1,
          1000,
        );
        const effectiveWeight = getEffectiveWeight(resolution.plan, configuredWeight);
        const householdTimeZone = requiredString(
          { timezone: householdData?.timezone },
          "timezone",
          1,
          64,
        );
        const startTime = Timestamp.fromMillis(now.toMillis() - durationSeconds * 1000);
        const score = calculateScore(durationSeconds, effectiveWeight);

        transaction.create(taskReference, {
          householdId,
          userId: caller.uid,
          status: "completed",
          startTime,
          endTime: now,
          durationSeconds,
          score,
          isManual: true,
          weekKey: isoWeekKey(now.toDate(), householdTimeZone),
          templateSnapshot: {
            templateId,
            name: templateName,
            category,
            configuredWeight,
            effectiveWeight,
            plan: resolution.plan,
          },
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(operationReference, {
          uid: caller.uid,
          action: "createManualTask",
          resourceId: taskReference.id,
          durationSeconds,
          score,
          completedAt: now,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 86_400_000),
        });
        return {
          taskId: taskReference.id,
          durationSeconds,
          score,
          status: "completed" as const,
          completedAt: now.toDate().toISOString(),
        };
      });

      return result;
    } catch (error) {
      return handleCallableError(error, "createManualTask");
    }
  },
);
