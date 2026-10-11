import { describe, it, expect } from "vitest";
import { emptyState, stateSchema, type State } from "./model";
import {
  notifications,
  visibleNotices,
  defaultNoticePreferences,
  inQuietHours,
} from "./notifications";
import { pushSchedule, zonedHour } from "./push-schedule";
function fixture() {
  const s = emptyState();
  s.profile.name = "Тест";
  s.profile.reserveMonths = 0;
  s.accounts = [
    {
      id: "a",
      name: "Карта",
      type: "card",
      currency: "RUB",
      initialMinor: 10000000,
      includeInTotal: true,
      archived: false,
      color: "#000",
    },
  ];
  s.recurring = [
    {
      id: "rent",
      name: "Аренда",
      type: "expense",
      amountMinor: 3000000,
      accountId: "a",
      categoryId: "cat-0",
      day: 13,
      startDate: "2026-10-01",
      active: true,
      mandatory: true,
    },
  ];
  return s;
}
const ids = (s: State) => notifications(s, "2026-10-12").map((n) => n.id);
describe("notifications", () => {
  it("upcoming is not an actual expense and resolved reminders disappear", () => {
    const s = fixture();
    expect(ids(s)).toContain("payment:rent:2026-10-13:soon");
    expect(s.transactions).toHaveLength(0);
    s.resolved = ["rent:2026-10-13"];
    expect(ids(s)).not.toContain("payment:rent:2026-10-13:soon");
  });
  it("honors categories, read status and tomorrow snooze with timezone", () => {
    const s = fixture(),
      id = "payment:rent:2026-10-13:soon";
    s.noticeStates = { [id]: { read: true, snoozedUntil: "2026-10-13" } };
    expect(
      visibleNotices(s, new Date("2026-10-12T12:00:00Z")).some(
        (n) => n.id === id,
      ),
    ).toBe(false);
    s.noticePreferences = {
      ...defaultNoticePreferences,
      kinds: { ...defaultNoticePreferences.kinds, payments: false },
    };
    expect(
      notifications(s, "2026-10-13").some((n) => n.kind === "payments"),
    ).toBe(false);
  });
  it("budget changes stage without generating repeated same-stage IDs", () => {
    const s = fixture();
    s.recurring = [];
    s.budgets = [{ id: "b", categoryId: "cat-0", limitMinor: 2000000 }];
    s.transactions = [
      {
        id: "t",
        type: "expense",
        amountMinor: 1700000,
        accountId: "a",
        categoryId: "cat-0",
        date: "2026-10-05",
        description: "",
        mandatory: false,
        impulsive: false,
        source: "manual",
        createdAt: "2026-10-05T12:00:00Z",
      },
    ];
    expect(ids(s)).toContain("budget:b:2026-10:near");
    s.transactions[0].amountMinor = 2100000;
    expect(ids(s)).toContain("budget:b:2026-10:over");
    expect(ids(s)).not.toContain("budget:b:2026-10:near");
  });
  it("a completed goal wins over an overdue deadline", () => {
    const s = fixture();
    s.goals = [
      {
        id: "g",
        name: "Отпуск",
        targetMinor: 10000,
        savedMinor: 10000,
        date: "2026-10-01",
        icon: "plane",
        archived: false,
      },
    ];
    const goals = notifications(s, "2026-10-12").filter(
      (n) => n.kind === "goals",
    );
    expect(goals).toHaveLength(1);
    expect(goals[0].priority).toBe("good");
  });
  it("older data still parse without notification settings", () => {
    expect(stateSchema.parse(fixture()).noticePreferences).toBeUndefined();
  });
  it("groups many overdue recurring reminders", () => {
    const s = fixture();
    s.recurring[0].startDate = "2026-01-01";
    expect(
      notifications(s, "2026-10-12").filter((n) => n.id.startsWith("overdue:")),
    ).toHaveLength(1);
  });
});
describe("private push scheduling", () => {
  it("converts Moscow wall time and summer/winter DST correctly", () => {
    expect(
      new Date(zonedHour("2026-10-12", 10, "Europe/Moscow")).toISOString(),
    ).toBe("2026-10-12T07:00:00.000Z");
    expect(
      new Date(zonedHour("2026-07-12", 10, "Europe/Berlin")).toISOString(),
    ).toBe("2026-07-12T08:00:00.000Z");
    expect(
      new Date(zonedHour("2026-12-12", 10, "Europe/Berlin")).toISOString(),
    ).toBe("2026-12-12T09:00:00.000Z");
  });
  it("quiet hours support overnight, daytime and disabled windows", () => {
    expect(inQuietHours(23, 22, 9)).toBe(true);
    expect(inQuietHours(8, 22, 9)).toBe(true);
    expect(inQuietHours(9, 22, 9)).toBe(false);
    expect(inQuietHours(14, 13, 16)).toBe(true);
    expect(inQuietHours(14, 14, 14)).toBe(false);
  });
  it("schedules neutral IDs and times; never transmits names or amounts", () => {
    const s = fixture();
    const jobs = pushSchedule(s, new Date("2026-10-12T20:00:00Z"));
    expect(jobs.length).toBeGreaterThan(0);
    expect(
      jobs.every(
        (j) =>
          new Date(j.at).getUTCHours() === 6 ||
          new Date(j.at).getUTCHours() === 7,
      ),
    ).toBe(true);
    expect(JSON.stringify(jobs)).not.toContain("Аренда");
    expect(Object.keys(jobs[0])).toEqual(["id", "at"]);
  });
  it("read, dismissed, paid or demo events do not become future pushes", () => {
    const s = fixture();
    s.noticeStates = { "payment:rent:2026-10-13:soon": { read: true } };
    expect(
      pushSchedule(s, new Date("2026-10-12T06:00:00Z")).some((j) =>
        j.id.endsWith(":soon"),
      ),
    ).toBe(false);
    s.resolved = ["rent:2026-10-13"];
    expect(pushSchedule(s, new Date("2026-10-12T06:00:00Z"))).toHaveLength(0);
    s.mode = "demo";
    expect(pushSchedule(s)).toHaveLength(0);
  });
});
