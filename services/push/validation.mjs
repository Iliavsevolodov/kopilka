export function validSubscription(s) {
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 4096)
    return false;
  try {
    const u = new URL(s.endpoint);
    if (u.protocol !== "https:" || u.port || u.username || u.password)
      return false;
    const host = u.hostname;
    if (
      !(
        host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.apple.com")
      )
    )
      return false;
    return (
      /^[A-Za-z0-9_-]{80,100}$/.test(s.keys?.p256dh ?? "") &&
      /^[A-Za-z0-9_-]{20,30}$/.test(s.keys?.auth ?? "")
    );
  } catch {
    return false;
  }
}
export function validJobs(jobs, now = Date.now()) {
  return (
    Array.isArray(jobs) &&
    jobs.length <= 200 &&
    new Set(jobs.map((j) => j.id)).size === jobs.length &&
    jobs.every(
      (j) =>
        j &&
        /^[a-f0-9]{64}$/.test(j.id) &&
        Number.isSafeInteger(j.at) &&
        j.at >= now - 300000 &&
        j.at <= now + 32 * 86400000,
    )
  );
}
