"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Check,
  Clock,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { useFinance } from "./provider";
import { BrandSelect } from "./branded-controls";
import { Field, Empty } from "./ui";
import {
  defaultNoticePreferences,
  labels,
  noticeKinds,
  visibleNotices,
  type Notice,
} from "@/lib/local/notifications";
import { today } from "@/lib/local/model";
import { PushSettings } from "./push-settings";
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}
export function NotificationBell() {
  const { state } = useFinance(),
    now = useClock(),
    count = visibleNotices(state, now).filter(
      (n) => !state.noticeStates?.[n.id]?.read,
    ).length;
  return (
    <Link
      href="/notifications"
      className="notification-bell"
      aria-label={`Уведомления${count ? `: ${count} непрочитанных` : ""}`}
    >
      <Bell size={20} />
      {count > 0 && <span>{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
export function Notifications() {
  const { state, update } = useFinance(),
    now = useClock(),
    active = visibleNotices(state, now);
  const [tab, setTab] = useState<"new" | "all" | "history">("new"),
    [settings, setSettings] = useState(false),
    [error, setError] = useState("");
  const prefs = state.noticePreferences ?? defaultNoticePreferences;
  const list =
    tab === "history"
      ? (state.noticeHistory ?? []).filter(
          (n) => !active.some((a) => a.id === n.id),
        )
      : tab === "new"
        ? active.filter((n) => !state.noticeStates?.[n.id]?.read)
        : active;
  async function act(n: Notice, action: "read" | "dismiss" | "snooze") {
    try {
      await update((s) => ({
        ...s,
        noticeStates: {
          ...s.noticeStates,
          [n.id]: {
            ...s.noticeStates?.[n.id],
            read: action !== "snooze",
            ...(action === "dismiss" ? { dismissed: true } : {}),
            ...(action === "snooze"
              ? {
                  snoozedUntil: format(
                    addDays(parseISO(today(s.profile.timezone)), 1),
                    "yyyy-MM-dd",
                  ),
                }
              : {}),
          },
        },
        noticeHistory: [
          n,
          ...(s.noticeHistory ?? []).filter((i) => i.id !== n.id),
        ].slice(0, 200),
      }));
    } catch {
      setError("Не удалось сохранить действие. Повторите попытку.");
    }
  }
  return (
    <>
      <div className="page-heading notice-heading">
        <div>
          <div className="eyebrow">ТОЛЬКО ТО, ЧТО ВАЖНО</div>
          <h1>Уведомления</h1>
          <p>Ближайшие события и подсказки для ваших финансов</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => setSettings(!settings)}
        >
          <Settings2 size={18} />
          Настройки уведомлений
        </button>
      </div>
      <div className="notice-delivery card">
        <ShieldCheck size={22} />
        <div>
          <strong>Ваши финансы остаются на устройстве</strong>
          <p>
            Центр обновляется при открытом приложении. Фоновая push-доставка
            подключается отдельно в настройках; разрешение браузера само по себе
            её не включает.
          </p>
        </div>
      </div>
      {settings && (
        <section className="card notice-settings">
          <h2>Какие события показывать</h2>
          <label className="notice-toggle">
            <span>
              <strong>Центр уведомлений</strong>
              <small>Можно отключить все новые подсказки</small>
            </span>
            <input
              aria-label="Включить уведомления"
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => {
                const checked = e.target.checked;
                void update((s) => ({
                  ...s,
                  noticePreferences: {
                    ...(s.noticePreferences ?? defaultNoticePreferences),
                    enabled: checked,
                  },
                })).catch(() => setError("Не удалось сохранить настройки"));
              }}
            />
          </label>
          {noticeKinds.map((kind) => (
            <label className="notice-toggle" key={kind}>
              <span>{labels[kind]}</span>
              <input
                type="checkbox"
                checked={prefs.kinds[kind]}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void update((s) => ({
                    ...s,
                    noticePreferences: {
                      ...(s.noticePreferences ?? defaultNoticePreferences),
                      kinds: {
                        ...(s.noticePreferences ?? defaultNoticePreferences)
                          .kinds,
                        [kind]: checked,
                      },
                    },
                  })).catch(() => setError("Не удалось сохранить настройки"));
                }}
              />
            </label>
          ))}
          <div className="report-filter-grid">
            {[
              ["leadDays", "Напомнить за", [1, 2, 3, 7]],
              [
                "reminderHour",
                "Время напоминания",
                Array.from({ length: 24 }, (_, i) => i),
              ],
              [
                "quietStart",
                "Тихие часы с",
                Array.from({ length: 24 }, (_, i) => i),
              ],
              [
                "quietEnd",
                "Тихие часы до",
                Array.from({ length: 24 }, (_, i) => i),
              ],
            ].map(([key, label, values]) => (
              <Field key={String(key)} label={String(label)}>
                <BrandSelect
                  value={prefs[key as "leadDays"]}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    void update((s) => ({
                      ...s,
                      noticePreferences: {
                        ...(s.noticePreferences ?? defaultNoticePreferences),
                        [String(key)]: value,
                      },
                    })).catch(() => setError("Не удалось сохранить настройки"));
                  }}
                >
                  {(values as number[]).map((v) => (
                    <option key={v} value={v}>
                      {key === "leadDays"
                        ? `${v} дн.`
                        : `${String(v).padStart(2, "0")}:00`}
                    </option>
                  ))}
                </BrandSelect>
              </Field>
            ))}
          </div>
          <p className="hint">
            Время — в часовом поясе {state.profile.timezone}. Совпадающее начало
            и конец отключают тихие часы. На экран блокировки отправляется
            только нейтральное напоминание без сумм и названий.
          </p>
          <PushSettings />
        </section>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="notice-toolbar">
        <div className="period-tabs">
          {(
            [
              ["new", "Новые"],
              ["all", "Активные"],
              ["history", "История"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          disabled={!active.some((n) => !state.noticeStates?.[n.id]?.read)}
          onClick={() =>
            void update((s) => ({
              ...s,
              noticeStates: {
                ...s.noticeStates,
                ...Object.fromEntries(
                  active.map((n) => [
                    n.id,
                    { ...s.noticeStates?.[n.id], read: true },
                  ]),
                ),
              },
              noticeHistory: [
                ...active,
                ...(s.noticeHistory ?? []).filter(
                  (n) => !active.some((a) => a.id === n.id),
                ),
              ].slice(0, 200),
            })).catch(() => setError("Не удалось отметить уведомления"))
          }
        >
          Прочитать все
        </button>
      </div>
      <div className="notice-list">
        {list.map((n) => (
          <article
            className={`card notice-item notice-${n.priority}`}
            key={n.id}
          >
            <span className="notice-symbol">
              <Bell size={20} />
            </span>
            <div>
              <small>
                {labels[n.kind]}
                {tab === "history" ? ` · ${n.date}` : ""}
              </small>
              <h2>{n.title}</h2>
              <p>{n.body}</p>
              {tab === "history" ? (
                <p className="hint">
                  {state.noticeStates?.[n.id]?.snoozedUntil &&
                  state.noticeStates[n.id].snoozedUntil! >
                    today(state.profile.timezone)
                    ? "Отложено до завтра"
                    : "Скрыто или больше не актуально"}
                </p>
              ) : (
                <div className="notice-actions">
                  <Link
                    className="text-button"
                    href={n.href}
                    onClick={() => void act(n, "read")}
                  >
                    Посмотреть
                  </Link>
                  {!state.noticeStates?.[n.id]?.read && (
                    <button
                      className="text-button"
                      onClick={() => void act(n, "read")}
                    >
                      <Check size={15} />
                      Прочитано
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => void act(n, "snooze")}
                  >
                    <Clock size={15} />
                    До завтра
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void act(n, "dismiss")}
                  >
                    <BellOff size={15} />
                    Скрыть
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty
          title={
            tab === "new" ? "Новых уведомлений нет" : "Здесь появятся события"
          }
          text="KOPILKA подскажет, когда приблизится платёж, изменится состояние бюджета или понадобится проверить операции."
        />
      )}
      {(state.noticeHistory?.length ?? 0) > 0 && (
        <button
          className="text-button"
          onClick={() =>
            void update((s) => ({
              ...s,
              noticeStates: {},
              noticeHistory: [],
            })).catch(() => setError("Не удалось восстановить подсказки"))
          }
        >
          Вернуть скрытые и отложенные подсказки
        </button>
      )}
    </>
  );
}
