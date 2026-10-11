import { test } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import webpush from "web-push";
test("isolates devices, replaces schedules, validates requests and deletes subscriptions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kopilka-push-test-")),
    keys = webpush.generateVAPIDKeys();
  const child = fork(new URL("./server.mjs", import.meta.url), {
    silent: true,
    env: {
      ...process.env,
      PORT: "0",
      APP_ORIGIN: "https://example.com",
      DATABASE_PATH: join(dir, "test.sqlite"),
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: "mailto:test@example.com",
    },
  });
  try {
    const [{ port }] = await Promise.race([
      once(child, "message"),
      new Promise((_, reject) => {
        const t = setTimeout(
          () => reject(Error("Service startup timeout")),
          10000,
        );
        t.unref();
      }),
    ]);
    const token = "a".repeat(64),
      other = "b".repeat(64);
    const send = (
      path,
      method,
      body,
      auth = token,
      origin = "https://example.com",
    ) =>
      fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          Origin: origin,
          Authorization: `Bearer ${auth}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const subscription = {
      endpoint: "https://fcm.googleapis.com/send/test",
      keys: { p256dh: "a".repeat(87), auth: "a".repeat(22) },
    };
    assert.equal(
      (await send("/subscribe", "POST", { subscription })).status,
      200,
    );
    const schedule = {
      jobs: [{ id: "f".repeat(64), at: Date.now() + 3600000 }],
      timezone: "Europe/Moscow",
      quietStart: 22,
      quietEnd: 9,
    };
    assert.equal(
      (await send("/schedule", "POST", schedule, other)).status,
      404,
    );
    assert.equal(
      (
        await send(
          "/schedule",
          "POST",
          schedule,
          token,
          "https://other.example",
        )
      ).status,
      403,
    );
    assert.equal((await send("/schedule", "POST", schedule)).status, 200);
    assert.equal(
      (await send("/schedule", "POST", { ...schedule, jobs: [] })).status,
      200,
    );
    assert.equal(
      (await send("/schedule", "POST", { ...schedule, quietStart: 25 })).status,
      400,
    );
    assert.equal((await send("/subscribe", "DELETE")).status, 200);
    assert.equal((await send("/schedule", "POST", schedule)).status, 404);
  } finally {
    child.kill();
    await once(child, "exit");
    await rm(dir, { recursive: true, force: true });
  }
});
