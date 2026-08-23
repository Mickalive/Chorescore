import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "./config";
import { db } from "./firebase";
import {
  enforceRateLimit,
  handleCallableError,
  requireCaller,
} from "./security";
import {
  booleanValue,
  requiredString,
  strictRecord,
  ValidationError,
} from "./validation";

const OPTIONAL_PURPOSE = "analytics_b2b";

export const setConsent = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 15,
    maxInstances: 20,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, [
        "purpose",
        "granted",
        "policyVersion",
      ]);
      const purpose = requiredString(input, "purpose", 1, 32);
      if (purpose !== OPTIONAL_PURPOSE) {
        throw new ValidationError("Finalité de consentement non prise en charge.");
      }
      const granted = booleanValue(input, "granted");
      const policyVersion = requiredString(input, "policyVersion", 1, 32);
      if (!/^v\d+\.\d+$/u.test(policyVersion)) {
        throw new ValidationError("Version de politique invalide.");
      }

      await enforceRateLimit(caller.uid, "setConsent", 20, 3600);

      const now = Timestamp.now();
      const reference = db.doc(`consents/${caller.uid}/purposes/${purpose}`);
      await reference.set(
        {
          purpose,
          granted,
          policyVersion,
          grantedAt: granted ? now : null,
          revokedAt: granted ? null : now,
          updatedAt: now,
        },
        { merge: true },
      );

      return {
        purpose,
        granted,
        policyVersion,
        recordedAt: now.toDate().toISOString(),
      };
    } catch (error) {
      return handleCallableError(error, "setConsent");
    }
  },
);
