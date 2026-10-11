import { test } from "node:test";
import assert from "node:assert/strict";
import { validJobs, validSubscription } from "./validation.mjs";
const subscription = {
  endpoint: "https://fcm.googleapis.com/send/example",
  keys: { p256dh: "a".repeat(87), auth: "a".repeat(22) },
};
test("push endpoint allowlist rejects SSRF and embedded credentials", () => {
  assert.equal(validSubscription(subscription), true);
  for (const endpoint of [
    "http://fcm.googleapis.com/a",
    "https://localhost/a",
    "https://169.254.169.254/a",
    "https://fcm.googleapis.com.attacker.com/a",
    "https://u:p@fcm.googleapis.com/a",
  ])
    assert.equal(validSubscription({ ...subscription, endpoint }), false);
});
test("schedule validates size, uniqueness, time bounds and opaque IDs", () => {
  const now = Date.now(),
    job = { id: "a".repeat(64), at: now + 60000 };
  assert.equal(validJobs([job], now), true);
  assert.equal(validJobs([job, job], now), false);
  assert.equal(validJobs([{ ...job, at: now + 40 * 86400000 }], now), false);
  assert.equal(validJobs([{ ...job, id: "name and amount" }], now), false);
});
