import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";

export {
  MAX_PRO_MEMBERS,
  MAX_STANDARD_MEMBERS,
  MIN_ANALYTICS_COHORT,
  TRIAL_DAYS,
} from "./constants";

export const APP_BASE_URL = defineString("APP_BASE_URL", { default: "" });
export const STRIPE_ENABLED = defineBoolean("STRIPE_ENABLED", { default: false });
export const ANALYTICS_AGGREGATION_ENABLED = defineBoolean(
  "ANALYTICS_AGGREGATION_ENABLED",
  { default: false },
);

export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
export const STRIPE_STANDARD_PRICE_ID = defineString("STRIPE_STANDARD_PRICE_ID", {
  default: "",
});
export const STRIPE_PRO_PRICE_ID = defineString("STRIPE_PRO_PRICE_ID", {
  default: "",
});
export const STRIPE_LIVE_MODE = defineBoolean("STRIPE_LIVE_MODE", {
  default: false,
});

export const FUNCTION_REGION = "europe-west6";

export function requireHttpsBaseUrl(rawValue: string): string {
  if (rawValue.length === 0) {
    throw new Error("APP_BASE_URL_MISSING");
  }

  const parsed = new URL(rawValue);
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("APP_BASE_URL_INVALID");
  }

  return parsed.toString().replace(/\/$/u, "");
}

export function requireConfiguredValue(name: string, value: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name}_MISSING`);
  }
  return value.trim();
}
