import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { emptyState, today, type State, type Transaction } from "./model";
import {
  addTransaction,
  balances,
  budgetMetrics,
  confirmRecurring,
  forecast,
  goalMonthly,
  metrics,
  occurrences,
  purchaseImpact,
  validateState,
} from "./finance";
import { demoState } from "./demo";
function fixture(): State {
  const s = emptyState();
  s.profile = { ...s.profile, name: "Тест", onboarded: true, reserveMonths: 0 };
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
    {
      id: "b",
      name: "Накопительный",
      type: "savings",
      currency: "RUB",
      initialMinor: 0,
      includeInTotal: true,
      archived: false,
      color: "#000",
    },
  ];
  return s;
}
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "expense-1",
    type: "expense",
    amountMinor: 1000000,
    accountId: "a",
    categoryId: "cat-0",
    date: "2026-10-05",
    description: "Покупка",
    mandatory: false,
    impulsive: false,
    source: "manual",
    createdAt: "2026-10-05T10:00:00.000Z",
    ...overrides,
  };
}
function withRecurring() {
  const s = fixture();
  s.recurring = [
    {
      id: "rent",
      name: "Аренда",
      type: "expense",
      amountMinor: 3000000,
      accountId: "a",
      categoryId: "cat-2",
      day: 10,
      startDate: "2026-10-01",
      active: true,
      mandatory: true,
    },
  ];
  return s;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
describe("local financial lifecycle", () => {
  it("acceptance: expense then transfer keeps total 90000 and expenses 10000", () => {
    let s = addTransaction(fixture(), tx());
    s = addTransaction(
      s,
      tx({
        id: "transfer",
        type: "transfer",
        amountMinor: 2000000,
        destinationAccountId: "b",
        categoryId: undefined,
      }),
    );
    expect(balances(s).map((a) => a.balanceMinor)).toEqual([7000000, 2000000]);
    expect(metrics(s).total).toBe(9000000);
    expect(metrics(s).flow.expensesMinor).toBe(1000000);
  });
  it("income updates balance and excludes transfer from savings rate", () => {
    const s = addTransaction(
      fixture(),
      tx({ type: "income", categoryId: "cat-21", amountMinor: 15000000 }),
    );
    expect(metrics(s).total).toBe(25000000);
    expect(metrics(s).flow.incomeMinor).toBe(15000000);
  });
  it("adjustment changes balance, not income or expenses", () => {
    const s = addTransaction(
      fixture(),
      tx({ type: "adjustment", amountMinor: -10000, categoryId: undefined }),
    );
    expect(metrics(s).total).toBe(9990000);
    expect(metrics(s).flow).toEqual({
      incomeMinor: 0,
      expensesMinor: 0,
      netMinor: 0,
    });
  });
  it("rejects negative expenses and invalid accounts/categories", () => {
    expect(() => addTransaction(fixture(), tx({ amountMinor: -1 }))).toThrow();
    expect(() =>
      addTransaction(fixture(), tx({ accountId: "foreign" })),
    ).toThrow();
    expect(() =>
      addTransaction(fixture(), tx({ categoryId: "cat-21" })),
    ).toThrow();
  });
  it("rejects self transfers and different currencies", () => {
    const s = fixture();
    expect(() =>
      addTransaction(s, tx({ type: "transfer", destinationAccountId: "a" })),
    ).toThrow();
    s.accounts[1].currency = "USD";
    expect(() =>
      addTransaction(s, tx({ type: "transfer", destinationAccountId: "b" })),
    ).toThrow();
  });
  it("rejects future actual transactions", () =>
    expect(() =>
      addTransaction(fixture(), tx({ date: "2026-10-06" })),
    ).toThrow());
  it("rejects unsafe values and corrupted restored references", () => {
    expect(() =>
      addTransaction(
        fixture(),
        tx({ amountMinor: Number.MAX_SAFE_INTEGER + 1 }),
      ),
    ).toThrow();
    const s = fixture();
    s.transactions = [tx({ accountId: "missing" })];
    expect(() => validateState(s)).toThrow();
  });
  it("idempotent operation IDs", () => {
    const s = addTransaction(fixture(), tx());
    expect(addTransaction(s, tx()).transactions).toHaveLength(1);
  });
  it("archiving retains historical balance but prevents new transactions", () => {
    const s = fixture();
    s.accounts[0].archived = true;
    expect(metrics(s).total).toBe(10000000);
    expect(() => addTransaction(s, tx())).toThrow();
  });
  it("keeps currencies separate", () => {
    const s = fixture();
    s.accounts[1].currency = "USD";
    s.accounts[1].initialMinor = 999999;
    expect(metrics(s).total).toBe(10000000);
  });
  it("excluded accounts do not affect total", () => {
    const s = fixture();
    s.accounts[0].includeInTotal = false;
    expect(metrics(s).total).toBe(0);
  });
  it("deleting an expense recomputes balance from ledger", () => {
    let s = addTransaction(fixture(), tx());
    s = { ...s, transactions: [] };
    expect(metrics(s).total).toBe(10000000);
  });
});
describe("planned versus actual", () => {
  it("rent due on 10th does not alter actual balance on 5th", () => {
    const s = withRecurring();
    expect(metrics(s).total).toBe(10000000);
    expect(metrics(s).flow.expensesMinor).toBe(0);
    expect(forecast(s, 7).end).toBe(7000000);
  });
  it("income in forecast is not received", () => {
    const s = withRecurring();
    s.recurring[0] = {
      ...s.recurring[0],
      type: "income",
      categoryId: "cat-21",
    };
    expect(metrics(s).flow.incomeMinor).toBe(0);
    expect(forecast(s, 7).end).toBe(13000000);
  });
  it("rejects early payment confirmation", () =>
    expect(() =>
      confirmRecurring(withRecurring(), "rent:2026-10-10"),
    ).toThrow());
  it("confirmation records a real expense exactly once and removes forecast duplicate", () => {
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    let s = confirmRecurring(withRecurring(), "rent:2026-10-10");
    s = confirmRecurring(s, "rent:2026-10-10");
    expect(s.transactions).toHaveLength(1);
    expect(metrics(s).flow.expensesMinor).toBe(3000000);
    expect(metrics(s).total).toBe(7000000);
    expect(forecast(s, 7).end).toBe(7000000);
  });
  it("skip leaves actual unchanged and removes expected occurrence", () => {
    const s = withRecurring();
    s.resolved = ["rent:2026-10-10"];
    expect(forecast(s, 7).end).toBe(10000000);
    expect(metrics(s).total).toBe(10000000);
  });
  it("31st clamps to February and returns to March 31", () => {
    const s = withRecurring();
    s.recurring[0].day = 31;
    s.recurring[0].startDate = "2026-01-01";
    expect(
      occurrences(s, "2026-02-01", "2026-03-31").map((o) => o.date),
    ).toEqual(["2026-02-28", "2026-03-31"]);
  });
  it("leap year month end", () => {
    const s = withRecurring();
    s.recurring[0].day = 31;
    s.recurring[0].startDate = "2024-01-01";
    expect(occurrences(s, "2024-02-01", "2024-02-29")[0].date).toBe(
      "2024-02-29",
    );
  });
  it("year boundary recurring", () => {
    const s = withRecurring();
    expect(
      occurrences(s, "2026-12-01", "2027-01-31").map((o) => o.date),
    ).toEqual(["2026-12-10", "2027-01-10"]);
  });
});
describe("planning calculations", () => {
  it("goal acceptance 40000 a month", () =>
    expect(goalMonthly(50000000, 10000000, "2027-08-05", "2026-10-05")).toBe(
      4000000,
    ));
  it("budget acceptance 75%, 5000 remaining", () => {
    const s = addTransaction(fixture(), tx({ amountMinor: 1500000 }));
    expect(
      budgetMetrics(s, {
        id: "budget",
        categoryId: "cat-0",
        limitMinor: 2000000,
      }),
    ).toMatchObject({
      usage: 0.75,
      remainingMinor: 500000,
      spentMinor: 1500000,
    });
  });
  it("safe to spend includes goals, mandatory reserve and scheduled bills", () => {
    const s = withRecurring();
    s.profile.mandatoryMinor = 1000000;
    s.profile.reserveMonths = 2;
    s.goals = [
      {
        id: "goal",
        name: "Цель",
        targetMinor: 5000000,
        savedMinor: 1000000,
        date: "2027-01-01",
        icon: "🎯",
        archived: false,
      },
    ];
    expect(metrics(s).safe).toBe(4000000);
  });
  it("safe to spend never goes below zero", () => {
    const s = withRecurring();
    s.profile.mandatoryMinor = 10000000;
    s.profile.reserveMonths = 3;
    expect(metrics(s).safe).toBe(0);
  });
  it("deposit excluded from liquid spending and forecast", () => {
    const s = fixture();
    s.accounts[0].type = "deposit";
    expect(metrics(s).total).toBe(10000000);
    expect(metrics(s).safe).toBe(0);
    expect(forecast(s, 30).end).toBe(0);
  });
  it("purchase identifies a future cash gap", () => {
    const s = withRecurring();
    const r = purchaseImpact(s, 9000000, "2026-10-05");
    expect(r.safe).toBe(false);
    expect(r.status).toBe("Высокий финансовый риск");
  });
  it("scenario range is ordered and forecast deterministic", () => {
    const s = fixture();
    s.profile.monthlyIncomeMinor = 15000000;
    expect(forecast(s, 30, "2026-10-05", "careful").end).toBeLessThan(
      forecast(s, 30).end,
    );
    expect(forecast(s, 30).end).toBeLessThan(
      forecast(s, 30, "2026-10-05", "optimistic").end,
    );
    expect(forecast(s, 30)).toEqual(forecast(s, 30));
  });
  it("timezone crosses UTC date correctly", () =>
    expect(today("Europe/Moscow", new Date("2026-10-05T22:30:00Z"))).toBe(
      "2026-10-06",
    ));
  it("demo is reproducible, valid and has six months of history", () => {
    const a = demoState();
    expect(a).toEqual(demoState());
    expect(validateState(a)).toEqual(a);
    expect(metrics(a).total).toBe(44250000);
    expect(metrics(a).historyMonths).toBe(6);
    expect(a.transactions.length).toBeGreaterThan(100);
  });
});

describe("overdue and excluded cash flow", () => {
  it("overdue expense reduces forecast and safe amount until confirmed", () => {
    const s = withRecurring();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    expect(metrics(s).safe).toBe(4000000);
    expect(forecast(s, 7).end).toBe(7000000);
  });
  it("overdue income is not treated as spendable", () => {
    const s = withRecurring();
    s.recurring[0] = {
      ...s.recurring[0],
      type: "income",
      categoryId: "cat-21",
    };
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    expect(forecast(s, 7).end).toBe(10000000);
  });
  it("income on excluded account does not inflate liquid forecast", () => {
    const s = withRecurring();
    s.accounts[0].includeInTotal = false;
    s.recurring[0] = {
      ...s.recurring[0],
      type: "income",
      categoryId: "cat-21",
    };
    expect(forecast(s, 7).end).toBe(0);
  });
});
