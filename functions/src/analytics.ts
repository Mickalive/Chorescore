import {
  FieldPath,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  ANALYTICS_AGGREGATION_ENABLED,
  FUNCTION_REGION,
  MIN_ANALYTICS_COHORT,
} from "./config";
import {
  aggregateAnalyticsEvents,
  AnalyticsEvent,
  TASK_CATEGORIES,
  TaskCategory,
} from "./domain";
import { db } from "./firebase";
import {
  handleCallableError,
  requireAdministrativeCaller,
} from "./security";
import { monthlyPeriod, strictRecord } from "./validation";

const PAGE_SIZE = 1000;
const MAX_EVENTS_PER_RUN = 100_000;

function parseCuratedEvent(data: Record<string, unknown>): AnalyticsEvent {
  const householdBucketId = data.householdBucketId;
  const category = data.category;
  const durationBucketMinutes = data.durationBucketMinutes;
  if (
    typeof householdBucketId !== "string" ||
    !/^[a-f0-9]{64}$/u.test(householdBucketId) ||
    typeof category !== "string" ||
    !(TASK_CATEGORIES as readonly string[]).includes(category) ||
    !Number.isInteger(durationBucketMinutes) ||
    (durationBucketMinutes as number) < 5 ||
    (durationBucketMinutes as number) > 1440 ||
    (durationBucketMinutes as number) % 5 !== 0
  ) {
    throw new HttpsError("internal", "Un événement analytique serveur est invalide.");
  }
  return {
    householdBucketId,
    category: category as TaskCategory,
    durationBucketMinutes: durationBucketMinutes as number,
  };
}

async function loadCuratedEvents(period: string): Promise<AnalyticsEvent[]> {
  const events: AnalyticsEvent[] = [];
  let cursor: QueryDocumentSnapshot | undefined;

  while (events.length <= MAX_EVENTS_PER_RUN) {
    let query = db
      .collection("analyticsRaw")
      .where("period", "==", period)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor !== undefined) {
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    for (const document of snapshot.docs) {
      events.push(parseCuratedEvent(document.data()));
    }
    if (snapshot.size < PAGE_SIZE) {
      return events;
    }
    cursor = snapshot.docs.at(-1);
  }

  throw new HttpsError(
    "resource-exhausted",
    "Le volume dépasse la limite sûre d'une agrégation synchrone.",
  );
}

export const generateAnalyticsAggregate = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 1,
  },
  async (request) => {
    try {
      requireAdministrativeCaller(request);
      if (!ANALYTICS_AGGREGATION_ENABLED.value()) {
        throw new HttpsError(
          "failed-precondition",
          "L'agrégation analytique est désactivée par défaut.",
        );
      }
      const input = strictRecord(request.data, ["period"]);
      const period = monthlyPeriod(input, "period");
      const events = await loadCuratedEvents(period);

      let aggregate;
      try {
        aggregate = aggregateAnalyticsEvents(events);
      } catch (error) {
        if (error instanceof Error && error.message === "COHORT_TOO_SMALL") {
          throw new HttpsError(
            "failed-precondition",
            `Au moins ${MIN_ANALYTICS_COHORT} foyers sont requis.`,
          );
        }
        throw error;
      }

      const generatedAt = Timestamp.now();
      await db.doc(`analyticsAggregates/${period}`).set({
        period,
        generatedAt,
        minimumCohortSize: MIN_ANALYTICS_COHORT,
        contributingHouseholds: aggregate.contributingHouseholds,
        categories: aggregate.categories,
      });

      return {
        period,
        generatedAt: generatedAt.toDate().toISOString(),
        contributingHouseholds: aggregate.contributingHouseholds,
        publishedCategories: Object.keys(aggregate.categories),
      };
    } catch (error) {
      return handleCallableError(error, "generateAnalyticsAggregate");
    }
  },
);
