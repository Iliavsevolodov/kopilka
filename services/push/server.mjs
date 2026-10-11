import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { chmodSync } from "node:fs";
import webpush from "web-push";
import { validJobs, validSubscription } from "./validation.mjs";
const origin = process.env.APP_ORIGIN;
if (
  !origin?.startsWith("https://") ||
  !process.env.VAPID_PUBLIC_KEY ||
  !process.env.VAPID_PRIVATE_KEY ||
  !process.env.VAPID_SUBJECT
)
  throw Error(
    "Set APP_ORIGIN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT",
  );
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
const path = process.env.DATABASE_PATH ?? "push.sqlite";
const db = new DatabaseSync(path);
chmodSync(path, 0o600);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, subscription TEXT NOT NULL, updated INTEGER NOT NULL,last_test INTEGER DEFAULT 0,last_sent INTEGER DEFAULT 0, timezone TEXT DEFAULT 'Europe/Moscow', quiet_start INTEGER DEFAULT 22, quiet_end INTEGER DEFAULT 9);
CREATE TABLE IF NOT EXISTS jobs (device TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,id TEXT NOT NULL,at INTEGER NOT NULL,attempts INTEGER DEFAULT 0,PRIMARY KEY(device,id));
CREATE TABLE IF NOT EXISTS delivered (device TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,id TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(device,id));
CREATE INDEX IF NOT EXISTS due_jobs ON jobs(at);`);
const limits = new Map();
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.headers.origin !== origin) {
    res.writeHead(403);
    return res.end("{}");
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const token = req.headers.authorization?.match(
    /^Bearer ([a-f0-9]{64})$/,
  )?.[1];
  if (!token) {
    res.writeHead(401);
    return res.end("{}");
  }
  const key = createHash("sha256").update(token).digest("hex"),
    now = Date.now();
  // Configure an edge IP rate limit as well; do not trust forwarded headers here.
  const ip = req.socket.remoteAddress ?? "unknown",
    rate = limits.get(ip) ?? { time: now, count: 0 };
  if (now - rate.time > 60000) {
    rate.time = now;
    rate.count = 0;
  }
  rate.count++;
  limits.set(ip, rate);
  if (rate.count > 120) {
    res.writeHead(429);
    return res.end("{}");
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) {
        res.writeHead(413);
        res.end("{}");
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : {};
    if (req.url === "/subscribe" && req.method === "POST") {
      if (!validSubscription(body.subscription)) {
        res.writeHead(400);
        return res.end("{}");
      }
      const count = db.prepare("SELECT COUNT(*) n FROM devices").get().n;
      if (
        count >= 10000 &&
        !db.prepare("SELECT id FROM devices WHERE id=?").get(key)
      ) {
        res.writeHead(503);
        return res.end("{}");
      }
      db.prepare(
        "INSERT INTO devices(id,subscription,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,updated=excluded.updated",
      ).run(key, JSON.stringify(body.subscription), now);
    } else {
      const device = db.prepare("SELECT * FROM devices WHERE id=?").get(key);
      if (!device) {
        res.writeHead(404);
        return res.end("{}");
      }
      if (req.url === "/subscribe" && req.method === "DELETE")
        db.prepare("DELETE FROM devices WHERE id=?").run(key);
      else if (req.url === "/schedule" && req.method === "POST") {
        let validZone = true;
        try {
          new Intl.DateTimeFormat("en", { timeZone: body.timezone }).format();
        } catch {
          validZone = false;
        }
        if (
          !validZone ||
          typeof body.timezone !== "string" ||
          !Number.isInteger(body.quietStart) ||
          !Number.isInteger(body.quietEnd) ||
          body.quietStart < 0 ||
          body.quietStart > 23 ||
          body.quietEnd < 0 ||
          body.quietEnd > 23 ||
          !validJobs(body.jobs, now)
        ) {
          res.writeHead(400);
          return res.end("{}");
        }
        db.exec("BEGIN");
        try {
          db.prepare("DELETE FROM jobs WHERE device=?").run(key);
          const insert = db.prepare(
            "INSERT INTO jobs(device,id,at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM delivered WHERE device=? AND id=?)",
          );
          for (const job of body.jobs)
            insert.run(key, job.id, job.at, key, job.id);
          db.prepare(
            "UPDATE devices SET updated=?,timezone=?,quiet_start=?,quiet_end=? WHERE id=?",
          ).run(now, body.timezone, body.quietStart, body.quietEnd, key);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      } else if (req.url === "/test" && req.method === "POST") {
        if (now - device.last_test < 60000) {
          res.writeHead(429);
          return res.end("{}");
        }
        db.prepare("UPDATE devices SET last_test=? WHERE id=?").run(now, key);
        await webpush.sendNotification(JSON.parse(device.subscription), "{}", {
          TTL: 60,
          timeout: 10000,
        });
      } else {
        res.writeHead(404);
        return res.end("{}");
      }
    }
    res.end('{"ok":true}');
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end('{"error":"request_failed"}');
  }
});
let working = false;
async function tick() {
  if (working) return;
  working = true;
  try {
    const now = Date.now();
    for (const [key, limit] of limits)
      if (now - limit.time > 120000) limits.delete(key);
    db.prepare("DELETE FROM devices WHERE updated<?").run(now - 45 * 86400000);
    db.prepare("DELETE FROM delivered WHERE at<?").run(now - 400 * 86400000);
    const devices = db
      .prepare(
        "SELECT DISTINCT d.* FROM devices d JOIN jobs j ON j.device=d.id WHERE j.at<=? AND d.last_sent<? LIMIT 100",
      )
      .all(now, now - 3600000);
    for (const d of devices) {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: d.timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      );
      const quiet =
        d.quiet_start === d.quiet_end
          ? false
          : d.quiet_start < d.quiet_end
            ? hour >= d.quiet_start && hour < d.quiet_end
            : hour >= d.quiet_start || hour < d.quiet_end;
      if (quiet) continue;
      const due = db
        .prepare("SELECT * FROM jobs WHERE device=? AND at<=?")
        .all(d.id, now);
      // Claim before network I/O so a crash does not generate duplicate batches.
      db.exec("BEGIN");
      for (const j of due) {
        db.prepare(
          "INSERT OR IGNORE INTO delivered(device,id,at) VALUES(?,?,?)",
        ).run(d.id, j.id, now);
        db.prepare("DELETE FROM jobs WHERE device=? AND id=?").run(d.id, j.id);
      }
      db.prepare("UPDATE devices SET last_sent=? WHERE id=?").run(now, d.id);
      db.exec("COMMIT");
      try {
        await webpush.sendNotification(JSON.parse(d.subscription), "{}", {
          TTL: 3600,
          urgency: "normal",
          timeout: 10000,
        });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410)
          db.prepare("DELETE FROM devices WHERE id=?").run(
            d.id,
          ); /* No financial payloads or endpoints in logs. A missed batch remains visible in the app. */
      }
    }
  } finally {
    working = false;
  }
}
const timer = setInterval(() => void tick().catch(() => {}), 30000);
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0", () =>
  process.send?.({ port: server.address().port }),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
