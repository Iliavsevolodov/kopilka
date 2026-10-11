"use client";
import { useEffect, useState } from "react";
import { useFinance } from "./provider";
import {
  PUSH_URL,
  PUSH_KEY,
  connectPush,
  disconnectPush,
  pushDevice,
  syncPush,
  testPush,
} from "@/lib/local/push-client";
export function PushSync() {
  const { state } = useFinance();
  useEffect(() => {
    if (!PUSH_URL || !pushDevice()) return;
    let cancelled = false;
    const run = () =>
      void syncPush()
        .then(() => {
          if (!cancelled) {
            sessionStorage.removeItem("kopilka.push.error");
            window.dispatchEvent(new Event("kopilka:push"));
          }
        })
        .catch(() => {
          if (!cancelled) {
            sessionStorage.setItem(
              "kopilka.push.error",
              "Не удалось обновить фоновые напоминания. При подключении к сети откройте KOPILKA снова.",
            );
            window.dispatchEvent(new Event("kopilka:push"));
          }
        });
    const timer = setTimeout(run, 700);
    const visible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [state]);
  return null;
}
export function PushSettings() {
  const { state } = useFinance(),
    [connected, setConnected] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [last, setLast] = useState("");
  useEffect(() => {
    const refresh = () => {
      setConnected(!!pushDevice());
      setLast(localStorage.getItem("kopilka.push.lastSync") ?? "");
      const err = sessionStorage.getItem("kopilka.push.error");
      if (err) setMessage(err);
    };
    refresh();
    window.addEventListener("kopilka:push", refresh);
    return () => window.removeEventListener("kopilka:push", refresh);
  }, []);
  async function action(which: "connect" | "disconnect" | "test" | "sync") {
    setBusy(true);
    setMessage("");
    try {
      if (which === "connect") await connectPush(state);
      if (which === "disconnect") await disconnectPush();
      if (which === "test") await testPush();
      if (which === "sync") await syncPush();
      setConnected(!!pushDevice());
      setLast(localStorage.getItem("kopilka.push.lastSync") ?? "");
      setMessage(
        which === "test"
          ? "Тест отправлен. Доставка зависит от сети и настроек телефона."
          : which === "disconnect"
            ? "Push-доставка отключена"
            : "Расписание передано сервису уведомлений",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Не удалось подключить уведомления",
      );
    } finally {
      setConnected(!!pushDevice());
      setBusy(false);
    }
  }
  return (
    <div className="push-settings">
      <h3>Уведомления при закрытом приложении</h3>
      {!PUSH_URL || !PUSH_KEY ? (
        <p>
          Фоновая push-доставка пока не подключена. Центр уведомлений уже
          работает внутри KOPILKA. Для доставки на экран блокировки нужен
          отдельный сервис отправки; разрешение браузера сейчас не
          запрашивается.
        </p>
      ) : (
        <>
          <p>
            На iPhone добавьте KOPILKA на экран «Домой» и откройте с иконки. При
            включении сервису передаются адрес push-подписки и время
            напоминаний. Суммы, названия и история операций остаются на
            устройстве.
          </p>
          <p className="hint">
            Расписание обновляется, когда вы пользуетесь приложением с
            интернетом. Если оплатить вне KOPILKA или изменить данные офлайн,
            старое напоминание может прийти до следующей синхронизации. Доставка
            не гарантируется точно в минуту.
          </p>
          {state.mode === "demo" ? (
            <p>
              Push не отправляются для демоданных. Переключитесь на свои
              финансы.
            </p>
          ) : (
            <div className="notice-actions">
              <button
                disabled={busy}
                className="btn-primary"
                onClick={() =>
                  void action(connected ? "disconnect" : "connect")
                }
              >
                {connected ? "Отключить push" : "Включить push-доставку"}
              </button>
              {connected && (
                <>
                  <button
                    disabled={busy}
                    className="btn-secondary"
                    onClick={() => void action("test")}
                  >
                    Тестовое уведомление
                  </button>
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={() => void action("sync")}
                  >
                    Обновить расписание
                  </button>
                </>
              )}
            </div>
          )}
          {last && (
            <p className="hint">
              Последняя синхронизация:{" "}
              {new Date(last).toLocaleString("ru-RU", {
                timeZone: state.profile.timezone,
              })}
            </p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
