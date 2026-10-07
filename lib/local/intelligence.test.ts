import { describe, it, expect } from "vitest";
import { emptyState, type State, type Transaction } from "./model";
import { editTransaction, balances, forecast } from "./finance";
import { behaviorProfile, simulateScenario } from "./intelligence";
function fixture(): State {
  const s = emptyState();
  s.profile.name = "Тест";
  s.profile.reserveMonths = 0;
  s.accounts = [
    {
      id: "a",
      name: "Карта",
      type: "card",
      initialMinor: 10000000,
      currency: "RUB",
      includeInTotal: true,
      archived: false,
      color: "#123456",
    },
    {
      id: "b",
      name: "Резерв",
      type: "savings",
      initialMinor: 0,
      currency: "RUB",
      includeInTotal: true,
      archived: false,
      color: "#123456",
    },
  ];
  return s;
}
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t",
    type: "expense",
    amountMinor: 1000000,
    accountId: "a",
    categoryId: "cat-0",
    date: "2026-01-05",
    description: "Тест",
    mandatory: false,
    impulsive: false,
    source: "manual",
    createdAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}
describe("auditable transaction editing", () => {
  it("replaces expense exactly once and preserves recurring metadata", () => {
    const s = fixture();
    const original = tx({
      source: "recurring",
      recurringKey: "rent:2026-01-05",
    });
    s.transactions = [original];
    const result = editTransaction(s, {
      ...original,
      amountMinor: 2000000,
      source: "manual",
      recurringKey: undefined,
    });
    expect(balances(result)[0].balanceMinor).toBe(8000000);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].source).toBe("recurring");
    expect(result.transactions[0].recurringKey).toBe(original.recurringKey);
    expect(result.transactions[0].updatedAt).toBeTruthy();
    expect(() => editTransaction(result, original)).toThrow("другой вкладке");
  });
  it("editing transfers redistributes money without changing total", () => {
    const s = fixture();
    const original = tx({
      type: "transfer",
      destinationAccountId: "b",
      categoryId: undefined,
    });
    s.transactions = [original];
    const result = editTransaction(s, { ...original, amountMinor: 2500000 });
    expect(balances(result).map((a) => a.balanceMinor)).toEqual([
      7500000, 2500000,
    ]);
  });
  it("rejects deleted operations and invalid transfers", () => {
    const s = fixture();
    expect(() => editTransaction(s, tx())).toThrow("удалена");
    s.transactions = [tx()];
    expect(() =>
      editTransaction(s, tx({ type: "transfer", destinationAccountId: "a" })),
    ).toThrow("другой счёт");
  });
});
describe("transparent intelligence", () => {
  it("compares equal day counts when months differ and ignores other currencies and transfers", () => {
    const s = fixture();
    s.transactions = [
      tx({ id: "jan", date: "2026-01-28", amountMinor: 100 }),
      tx({ id: "jan31", date: "2026-01-31", amountMinor: 500 }),
      tx({ id: "feb", date: "2026-02-28", amountMinor: 200 }),
      tx({
        id: "transfer",
        date: "2026-02-28",
        type: "transfer",
        destinationAccountId: "b",
        amountMinor: 500,
      }),
    ];
    const p = behaviorProfile(s, "2026-02-28");
    expect(p.previousMinor).toBe(100);
    expect(p.currentMinor).toBe(200);
    expect(p.change).toBe(100);
  });
  it("does not invent a score without history", () => {
    expect(behaviorProfile(fixture(), "2026-01-08").score).toBeNull();
  });
  it("zero changes reproduce forecast; income arrives only every 30 days", () => {
    const s = fixture();
    const baseline = simulateScenario(
      s,
      { incomeDeltaMinor: 0, variableReductionPercent: 0, purchaseMinor: 0 },
      "2026-01-01",
    );
    expect(baseline.end).toBe(forecast(s, 365, "2026-01-01").end);
    const scenario = simulateScenario(
      s,
      {
        incomeDeltaMinor: 10000,
        variableReductionPercent: 0,
        purchaseMinor: 1000,
      },
      "2026-01-01",
    );
    expect(scenario.delta).toBe(119000);
    expect(scenario.points[29].balance - baseline.points[29].balance).toBe(
      -1000,
    );
    expect(scenario.points[30].balance - baseline.points[30].balance).toBe(
      9000,
    );
    expect(s.transactions).toHaveLength(0);
  });
  it("rejects negative purchases", () => {
    expect(() =>
      simulateScenario(fixture(), {
        incomeDeltaMinor: 0,
        variableReductionPercent: 0,
        purchaseMinor: -1,
      }),
    ).toThrow();
  });
});
