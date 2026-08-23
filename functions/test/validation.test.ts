import assert from "node:assert/strict";
import test from "node:test";

import {
  booleanValue,
  firestoreId,
  integer,
  inviteToken,
  monthlyPeriod,
  requiredString,
  strictRecord,
  taskCategory,
  timeZone,
  uuidV4,
  ValidationError,
} from "../src/validation";

test("la validation refuse les champs inconnus et caractères de contrôle", () => {
  assert.throws(() => strictRecord({ known: true, injected: true }, ["known"]), ValidationError);
  assert.throws(() => requiredString({ name: "a\u0000b" }, "name", 1, 10), ValidationError);
  assert.equal(requiredString({ name: "  Ménage  " }, "name", 1, 20), "Ménage");
});

test("les identifiants, UUID et jetons sont strictement bornés", () => {
  assert.equal(firestoreId({ id: "home_123" }, "id"), "home_123");
  assert.throws(() => firestoreId({ id: "../home" }, "id"), ValidationError);
  assert.equal(
    uuidV4({ key: "123e4567-e89b-42d3-a456-426614174000" }, "key"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
  assert.throws(() => uuidV4({ key: "123e4567-e89b-12d3-a456-426614174000" }, "key"), ValidationError);
  assert.equal(inviteToken({ token: "A".repeat(43) }, "token"), "A".repeat(43));
  assert.throws(() => inviteToken({ token: "short" }, "token"), ValidationError);
});

test("les valeurs métier n'acceptent pas de coercition implicite", () => {
  assert.equal(integer({ minutes: 30 }, "minutes", 1, 1_440), 30);
  assert.throws(() => integer({ minutes: "30" }, "minutes", 1, 1_440), ValidationError);
  assert.equal(booleanValue({ granted: false }, "granted"), false);
  assert.throws(() => booleanValue({ granted: 0 }, "granted"), ValidationError);
  assert.equal(taskCategory({ category: "dishes" }, "category"), "dishes");
  assert.throws(() => taskCategory({ category: "admin" }, "category"), ValidationError);
});

test("les fuseaux et périodes suivent des formats fermés", () => {
  assert.equal(timeZone({ timezone: "Europe/Zurich" }, "timezone"), "Europe/Zurich");
  assert.throws(() => timeZone({ timezone: "Mars/Olympus" }, "timezone"), ValidationError);
  assert.equal(monthlyPeriod({ period: "2026-08" }, "period"), "2026-08");
  assert.throws(() => monthlyPeriod({ period: "2026-13" }, "period"), ValidationError);
});
