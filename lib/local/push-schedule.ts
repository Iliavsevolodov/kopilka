import { addDays, addMonths, format, parseISO } from "date-fns";
import { occurrences } from "./finance";
import {
  defaultNoticePreferences,
  inQuietHours,
  notifications,
} from "./notifications";
import { today, type State } from "./model";
/** Convert a user's wall-clock hour to UTC, including changes in timezone offset. */
export function zonedHour(day: string, hour: number, zone: string) {
  const desired = Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  let timestamp = desired;
  for (let i = 0; i < 4; i++) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(timestamp);
    const get = (k: string) => p.find((v) => v.type === k)!.value;
    const actual = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    const diff = desired - actual;
    if (!diff) break;
    timestamp += diff;
  }
  return timestamp;
}
export function pushSchedule(s: State, now = new Date()) {
  const prefs = s.noticePreferences ?? defaultNoticePreferences;
  if (!prefs.enabled || s.mode === "demo") return [];
  const asOf = today(s.profile.timezone, now),
    end = format(addDays(parseISO(asOf), 30), "yyyy-MM-dd");
  const entries = new Map<string, string>();
  const add = (id: string, day: string) => {
    const status = s.noticeStates?.[id];
    if (status?.dismissed || status?.read) return;
    if (status?.snoozedUntil && day < status.snoozedUntil)
      day = status.snoozedUntil;
    if (day < asOf) day = asOf;
    entries.set(id, day);
  };
  for (const n of notifications(s, asOf)) add(n.id, asOf);
  if (prefs.kinds.payments)
    for (const o of occurrences(s, asOf, end)) {
      const lead = format(
        addDays(parseISO(o.date), -prefs.leadDays),
        "yyyy-MM-dd",
      );
      if (lead >= asOf && o.date > asOf) add(`payment:${o.key}:soon`, lead);
      add(`payment:${o.key}:today`, o.date);
      const late = format(addDays(parseISO(o.date), 1), "yyyy-MM-dd");
      add(`late:${o.key}`, late);
    }
  if (prefs.kinds.goals)
    for (const g of s.goals.filter(
      (g) =>
        !g.archived &&
        g.savedMinor < g.targetMinor &&
        g.date <= end &&
        g.date >= asOf,
    )) {
      add(
        `goal:${g.id}:due:${g.date}`,
        format(addDays(parseISO(g.date), -7), "yyyy-MM-dd"),
      );
      add(
        `goal:${g.id}:late:${g.date}`,
        format(addDays(parseISO(g.date), 1), "yyyy-MM-dd"),
      );
    }
  if (prefs.kinds.habits) {
    const last = s.transactions
      .map((t) => t.date)
      .sort()
      .at(-1);
    if (last)
      add(`habit:${last}`, format(addDays(parseISO(last), 3), "yyyy-MM-dd"));
  }
  if (prefs.kinds.summary && s.transactions.length) {
    const nextMonth = format(
      addMonths(parseISO(asOf.slice(0, 7) + "-01"), 1),
      "yyyy-MM-dd",
    );
    add(`summary:${nextMonth.slice(0, 7)}`, nextMonth);
  }
  return [...entries]
    .map(([id, day]) => {
      let at = zonedHour(day, prefs.reminderHour, s.profile.timezone);
      if (at < now.getTime()) at = now.getTime() + 60000;
      for (let i = 0; i < 26; i++) {
        const hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: s.profile.timezone,
            hour: "numeric",
            hourCycle: "h23",
          }).format(at),
        );
        if (!inQuietHours(hour, prefs.quietStart, prefs.quietEnd)) break;
        const next = new Date(at);
        next.setUTCMinutes(0, 0, 0);
        at = next.getTime() + 3600000;
      }
      return { id, at };
    })
    .filter((e) => e.at <= now.getTime() + 31 * 86400000)
    .slice(0, 200);
}
