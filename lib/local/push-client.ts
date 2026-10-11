import { readState } from "./repository";
import { defaultNoticePreferences } from "./notifications";
import { pushSchedule } from "./push-schedule";
import type { State } from "./model";
export const PUSH_URL = process.env.NEXT_PUBLIC_PUSH_SERVICE_URL ?? "";
export const PUSH_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const STORAGE = "kopilka.push.device.v1";
export function pushDevice(): { token: string } | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "null");
  } catch {
    return null;
  }
}
function base64Bytes(v: string) {
  const raw = atob(v.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function request(path: string, token: string, body?: unknown) {
  const response = await fetch(`${PUSH_URL.replace(/\/$/, "")}${path}`, {
    method: body ? "POST" : "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      "Сервис уведомлений недоступен. Проверьте соединение и повторите.",
    );
}
async function syncCurrentPush() {
  const state = readState();
  const d = pushDevice();
  if (!d || !PUSH_URL) return;
  const events = state.mode === "demo" ? [] : pushSchedule(state);
  const jobs = await Promise.all(
    events.map(async (e) => ({
      id: Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e.id)),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      at: e.at,
    })),
  );
  if (pushDevice()?.token !== d.token) return;
  const prefs = state.noticePreferences ?? defaultNoticePreferences;
  await request("/schedule", d.token, {
    jobs,
    timezone: state.profile.timezone,
    quietStart: prefs.quietStart,
    quietEnd: prefs.quietEnd,
  });
  localStorage.setItem("kopilka.push.lastSync", new Date().toISOString());
}
let syncQueue: Promise<void> = Promise.resolve();
export function syncPush() {
  const work = async () =>
    navigator.locks
      ? navigator.locks.request("kopilka-push-sync", syncCurrentPush)
      : syncCurrentPush();
  syncQueue = syncQueue.catch(() => {}).then(work);
  return syncQueue;
}
export async function connectPush(state: State) {
  if (state.mode === "demo") throw Error("Push недоступны для демоданных");
  if (!PUSH_URL || !PUSH_KEY)
    throw Error("Сервис фоновой отправки ещё не подключён");
  if (!PUSH_URL.startsWith("https://"))
    throw Error("Для push требуется защищённый адрес сервиса");
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw Error(
      "Добавьте KOPILKA на экран «Домой» и откройте с иконки. Проверьте поддержку уведомлений браузером.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Уведомления не разрешены. Разрешение можно изменить в настройках устройства.",
    );
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64Bytes(PUSH_KEY),
    }));
  const previous = pushDevice();
  const token =
    previous?.token ??
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  try {
    await request("/subscribe", token, { subscription: sub.toJSON() });
    localStorage.setItem(STORAGE, JSON.stringify({ token }));
    await syncPush();
  } catch (e) {
    if (!previous) {
      await sub.unsubscribe();
      localStorage.removeItem(STORAGE);
    }
    throw e;
  }
}
export async function disconnectPush() {
  const d = pushDevice();
  localStorage.removeItem(STORAGE);
  localStorage.removeItem("kopilka.push.lastSync");
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  if (d && PUSH_URL) await request("/subscribe", d.token);
}
export async function testPush() {
  const d = pushDevice();
  if (!d) throw Error("Сначала включите push-доставку");
  await request("/test", d.token, {});
}
