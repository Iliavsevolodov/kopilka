import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { emptyState, stateSchema, type Transaction } from "./model";
import {
  addTransaction,
  balances,
  metrics,
  budgetMetrics,
  editTransaction,
  validateState,
} from "./finance";
import { reportingEntries, removeTransaction, refundable } from "./ledger";
import { parseCsv, guessMap, previewCsv, importRows } from "./csv";
import { defaultFilter, report, priorRange } from "./reports";
import { spendingPlan } from "./spending";
import { behaviorProfile } from "./intelligence";
import { attentionItems } from "./attention";
function fixture() {
  const s = emptyState();
  s.profile.reserveMonths = 0;
  s.profile.name = "Тест";
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
  return s;
}
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "purchase",
    type: "expense",
    date: "2026-10-05",
    accountId: "a",
    categoryId: "cat-0",
    amountMinor: 1000000,
    description: "Покупка",
    merchant: "Магазин",
    tags: ["Дом"],
    mandatory: false,
    impulsive: false,
    source: "manual",
    createdAt: "2026-10-05T10:00:00Z",
    ...overrides,
  };
}
beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00Z") }));
afterEach(() => vi.useRealTimers());
describe("splits and refunds preserve cash and reporting", () => {
  it("stores one debit, distributes categories, nets multiple partial refunds without inflating income", () => {
    let s = addTransaction(
      fixture(),
      tx({
        allocations: [
          { categoryId: "cat-0", amountMinor: 700000 },
          { categoryId: "cat-1", amountMinor: 300000 },
        ],
      }),
    );
    expect(balances(s)[0].balanceMinor).toBe(9000000);
    expect(metrics(s).flow.expensesMinor).toBe(1000000);
    s = addTransaction(
      s,
      tx({
        id: "return",
        type: "income",
        refundOf: "purchase",
        date: "2026-10-06",
        amountMinor: 200000,
        categoryId: "cat-1",
      }),
    );
    expect(balances(s)[0].balanceMinor).toBe(9200000);
    expect(metrics(s).flow).toEqual({
      incomeMinor: 0,
      expensesMinor: 800000,
      netMinor: -800000,
    });
    expect(
      budgetMetrics(s, { id: "b", categoryId: "cat-1", limitMinor: 200000 })
        .spentMinor,
    ).toBe(100000);
    expect(
      refundable(s, s.transactions.find((t) => t.id === "purchase")!, "cat-1"),
    ).toBe(100000);
    expect(() =>
      addTransaction(
        s,
        tx({
          id: "over",
          type: "income",
          refundOf: "purchase",
          amountMinor: 100001,
          categoryId: "cat-1",
        }),
      ),
    ).toThrow("превышает");
    s = addTransaction(
      s,
      tx({
        id: "rest",
        type: "income",
        refundOf: "purchase",
        amountMinor: 100000,
        categoryId: "cat-1",
      }),
    );
    expect(metrics(s).flow.expensesMinor).toBe(700000);
    expect(validateState(stateSchema.parse(s))).toBeTruthy();
  });
  it("rejects bad split sums and wrong currency or dates", () => {
    expect(() =>
      addTransaction(
        fixture(),
        tx({
          allocations: [
            { categoryId: "cat-0", amountMinor: 1 },
            { categoryId: "cat-1", amountMinor: 1 },
          ],
        }),
      ),
    ).toThrow("Сумма частей");
    const s = addTransaction(fixture(), tx());
    expect(() =>
      addTransaction(
        s,
        tx({
          id: "r",
          type: "income",
          refundOf: "purchase",
          date: "2026-10-01",
        }),
      ),
    ).toThrow("предшествовать");
    s.accounts.push({ ...s.accounts[0], id: "usd", currency: "USD" });
    expect(() =>
      addTransaction(
        s,
        tx({ id: "r", type: "income", refundOf: "purchase", accountId: "usd" }),
      ),
    ).toThrow("Валюта");
  });
  it("prevents deleting/editing a purchase with refunds and reverses a deleted refund", () => {
    let s = addTransaction(fixture(), tx());
    s = addTransaction(
      s,
      tx({
        id: "r",
        type: "income",
        refundOf: "purchase",
        amountMinor: 100000,
      }),
    );
    expect(() => removeTransaction(s, "purchase")).toThrow("возвраты");
    expect(() =>
      editTransaction(s, s.transactions.find((t) => t.id === "purchase")!),
    ).toThrow("возвраты");
    s = removeTransaction(s, "r");
    expect(balances(s)[0].balanceMinor).toBe(9000000);
    expect(removeTransaction(s, "purchase").transactions).toHaveLength(0);
  });
  it("attributes refunds to the original event and actual refund date", () => {
    let s = addTransaction(fixture(), tx({ date: "2026-09-01" }));
    s = addTransaction(
      s,
      tx({
        id: "r",
        type: "income",
        refundOf: "purchase",
        tags: undefined,
        merchant: undefined,
        amountMinor: 100000,
      }),
    );
    const result = report(s, { ...defaultFilter("2026-10-08"), tag: "Дом" });
    expect(result.flow).toEqual({
      incomeMinor: 0,
      expensesMinor: -100000,
      netMinor: 100000,
    });
    expect(reportingEntries(s).find((t) => t.id === "r")?.merchant).toBe(
      "Магазин",
    );
  });
  it("reads backups with no new fields", () => {
    expect(stateSchema.parse(fixture()).transactions).toEqual([]);
  });
});
it("counts a split impulsive purchase once, without counting its refund as a purchase", () => {
  let s = addTransaction(
    fixture(),
    tx({
      impulsive: true,
      allocations: [
        { categoryId: "cat-0", amountMinor: 500000 },
        { categoryId: "cat-1", amountMinor: 500000 },
      ],
    }),
  );
  s = addTransaction(
    s,
    tx({ id: "r", type: "income", refundOf: "purchase", amountMinor: 100000 }),
  );
  expect(behaviorProfile(s).impulseCount).toBe(1);
});
describe("CSV review and atomic import", () => {
  it("handles BOM, semicolon, quoted descriptions and escaped quotes", () => {
    const file = parseCsv(
      '\uFEFFДата;Сумма;Описание\r\n05.10.2026;-1 234,56;"Еда; кофе\n""дом"""',
    );
    expect(file.rows[0][2]).toBe('Еда; кофе\n"дом"');
    const preview = previewCsv(
      fixture(),
      file.rows,
      guessMap(file.headers),
      "a",
      "batch",
    );
    expect(preview[0].transaction?.amountMinor).toBe(123456);
    expect(preview[0].transaction?.type).toBe("expense");
    expect(
      importRows(fixture(), preview, new Set([2])).transactions,
    ).toHaveLength(1);
  });
  it("flags duplicates within a file and rejects stale repeated import", () => {
    const file = parseCsv(
      "Дата,Сумма,Описание\n2026-10-05,-100,Кофе\n2026-10-05,-100,Кофе",
    );
    const preview = previewCsv(
      fixture(),
      file.rows,
      guessMap(file.headers),
      "a",
      "batch",
    );
    expect(preview[1].duplicate).toBe(true);
    const s = importRows(fixture(), preview, new Set([2]));
    const again = previewCsv(
      s,
      file.rows,
      guessMap(file.headers),
      "a",
      "other",
    );
    expect(again.every((r) => r.duplicate)).toBe(true);
    expect(() => importRows(s, again, new Set([2]))).toThrow("дубль");
  });
  it("reports bad dates, zero amounts and transfers without persisting anything", () => {
    const file = parseCsv(
      "Дата;Сумма;Тип\n2026-02-31;100;расход\n2026-10-05;0;доход\n2026-10-05;100;transfer",
    );
    const s = fixture(),
      preview = previewCsv(s, file.rows, guessMap(file.headers), "a", "batch");
    expect(preview.every((r) => r.error)).toBe(true);
    expect(s.transactions).toHaveLength(0);
    expect(() => importRows(s, preview, new Set([2, 3]))).toThrow();
    expect(s.transactions).toHaveLength(0);
  });
});
describe("periods, spending and attention", () => {
  it("compares equal calendar dates and handles February", () => {
    expect(priorRange("month", "2026-03-01", "2026-03-31")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(priorRange("custom", "2026-10-01", "2026-10-08")).toEqual({
      from: "2026-09-23",
      to: "2026-09-30",
    });
  });
  it("does not add expected income to spendable money", () => {
    const s = fixture();
    s.profile.monthlyIncomeMinor = 0;
    s.recurring = [
      {
        id: "salary",
        name: "Зарплата",
        type: "income",
        amountMinor: 5000000,
        accountId: "a",
        categoryId: "cat-21",
        day: 10,
        startDate: "2026-10-01",
        active: true,
        mandatory: false,
      },
    ];
    const m = spendingPlan(s);
    expect(m.safe).toBe(10000000);
    expect(m.expectedIncome).toBe(5000000);
    expect(m.projected).toBe(15000000);
  });
  it("suggests a monthly template only after three matches and honours dismissal", () => {
    const s = fixture();
    s.transactions = ["2026-08-05", "2026-09-05", "2026-10-05"].map((date, i) =>
      tx({ id: `t${i}`, date, amountMinor: 10000 }),
    );
    const recurring = attentionItems(s).filter((i) => i.kind === "recurring");
    expect(recurring).toHaveLength(1);
    s.dismissedAttention = [recurring[0].id];
    expect(
      attentionItems(s).filter((i) => i.kind === "recurring"),
    ).toHaveLength(0);
    expect(s.recurring).toHaveLength(0);
  });
});
