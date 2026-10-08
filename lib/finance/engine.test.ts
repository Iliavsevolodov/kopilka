import { describe, expect, it } from "vitest";
import {
  applyTransactionToBalances,
  calculateBudgetProjection,
  calculateCashFlow,
  calculateForecast,
  calculateGoalProjection,
  calculateSafeToSpend,
  calculateSavingsRate,
  calculateTotalBalance,
} from "@/lib/finance/engine";
import { parseMajorToMinor } from "@/lib/finance/money";
describe("money", () => {
  it("parses minor units without floating point math", () => {
    expect(parseMajorToMinor("120 000")).toBe(12_000_000);
    expect(parseMajorToMinor("1499,90")).toBe(149_990);
  });
});
describe("financial engine", () => {
  const accounts = [
    { id: "card", balanceMinor: 10_000_000 },
    { id: "savings", balanceMinor: 0 },
  ];
  it("expense reduces capital", () => {
    expect(
      calculateTotalBalance(
        applyTransactionToBalances(accounts, {
          type: "expense",
          amountMinor: 1_000_000,
          accountId: "card",
        }),
      ),
    ).toBe(9_000_000);
  });
  it("income increases capital", () => {
    expect(
      calculateTotalBalance(
        applyTransactionToBalances(accounts, {
          type: "income",
          amountMinor: 1_000_000,
          accountId: "card",
        }),
      ),
    ).toBe(11_000_000);
  });
  it("transfer preserves total capital", () => {
    const r = applyTransactionToBalances(accounts, {
      type: "transfer",
      amountMinor: 2_000_000,
      accountId: "card",
      destinationAccountId: "savings",
    });
    expect(r[0].balanceMinor).toBe(8_000_000);
    expect(r[1].balanceMinor).toBe(2_000_000);
    expect(calculateTotalBalance(r)).toBe(10_000_000);
  });
  it("cash flow excludes transfer", () => {
    expect(
      calculateCashFlow([
        { type: "income", amountMinor: 15_000_000 },
        { type: "expense", amountMinor: 10_000_000 },
        { type: "transfer", amountMinor: 2_000_000 },
      ]),
    ).toEqual({
      incomeMinor: 15_000_000,
      expensesMinor: 10_000_000,
      netMinor: 5_000_000,
    });
  });
  it("savings rate acceptance", () => {
    expect(calculateSavingsRate(15_000_000, 10_000_000)).toBeCloseTo(
      33.333333,
      5,
    );
  });
  it("safe to spend clamps to zero", () => {
    expect(
      calculateSafeToSpend({
        liquidBalanceMinor: 10_000_000,
        obligationsUntilNextIncomeMinor: 2_000_000,
        reservedGoalMoneyMinor: 1_000_000,
        minimumEmergencyReserveMinor: 3_000_000,
      }),
    ).toBe(4_000_000);
    expect(
      calculateSafeToSpend({
        liquidBalanceMinor: 1_000_000,
        obligationsUntilNextIncomeMinor: 2_000_000,
        reservedGoalMoneyMinor: 0,
        minimumEmergencyReserveMinor: 0,
      }),
    ).toBe(0);
  });
  it("goal contribution acceptance", () => {
    expect(
      calculateGoalProjection({
        targetMinor: 50_000_000,
        savedMinor: 10_000_000,
        monthsRemaining: 10,
      }),
    ).toBe(4_000_000);
  });
  it("budget projection", () => {
    expect(
      calculateBudgetProjection({
        spentMinor: 1_500_000,
        budgetMinor: 2_000_000,
        elapsedDays: 15,
        totalDays: 30,
      }),
    ).toMatchObject({
      usage: 0.75,
      remainingMinor: 500_000,
      projectedMinor: 3_000_000,
      willExceed: true,
    });
  });
  it("future recurring changes forecast, not current", () => {
    const current = 10_000_000;
    expect(
      calculateForecast(current, [{ type: "expense", amountMinor: 3_000_000 }]),
    ).toBe(7_000_000);
    expect(current).toBe(10_000_000);
  });
  it("planned income changes forecast, not current", () => {
    const current = 10_000_000;
    expect(
      calculateForecast(current, [{ type: "income", amountMinor: 5_000_000 }]),
    ).toBe(15_000_000);
    expect(current).toBe(10_000_000);
  });
});
