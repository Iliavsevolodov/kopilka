import { addDays, format, parseISO, subMonths } from "date-fns";
import { metrics, forecast, budgetMetrics } from "./finance";
import { today, type State } from "./model";

/** Compare month-to-date with the same number of calendar days in the prior month. */
export function behaviorProfile(s: State, asOf = today(s.profile.timezone)) {
  const m = metrics(s, asOf);
  const previousEnd = format(subMonths(parseISO(asOf), 1), "yyyy-MM-dd");
  const previousStart = previousEnd.slice(0, 7) + "-01";
  const start = asOf.slice(0, 7) + "-01";
  const expenses = m.currencyTx.filter((t) => t.type === "expense");
  const comparisonEnd = asOf.slice(0, 8) + previousEnd.slice(8);
  const current = expenses.filter(
    (t) => t.date >= start && t.date <= comparisonEnd,
  );
  const previous = expenses.filter(
    (t) => t.date >= previousStart && t.date <= previousEnd,
  );
  const sum = (tx: typeof expenses) =>
    tx.reduce((n, t) => n + t.amountMinor, 0);
  const currentMinor = sum(current),
    previousMinor = sum(previous);
  const categories = s.categories
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const currentMinor = sum(current.filter((t) => t.categoryId === c.id));
      const previousMinor = sum(previous.filter((t) => t.categoryId === c.id));
      return {
        id: c.id,
        name: c.name,
        currentMinor,
        previousMinor,
        difference: currentMinor - previousMinor,
        growth: previousMinor
          ? ((currentMinor - previousMinor) / previousMinor) * 100
          : null,
      };
    })
    .filter((c) => c.currentMinor || c.previousMinor)
    .sort((a, b) => b.difference - a.difference);
  const impulsive = current.filter((t) => t.impulsive);
  const excessBudgets = s.budgets.filter(
    (b) => budgetMetrics(s, b, asOf).spentMinor > b.limitMinor,
  ).length;
  const components = [
    {
      name: "Резерв",
      value: Math.round(Math.min(1, Math.max(0, m.cushion) / 3) * 100),
      explanation:
        "100 баллов — накопления покрывают 3 месяца обязательных расходов.",
    },
    {
      name: "Накопления",
      value: Math.round(Math.min(1, Math.max(0, m.rate) / 30) * 100),
      explanation:
        "100 баллов — сохраняется не менее 30% дохода текущего месяца.",
    },
    {
      name: "Бюджеты",
      value: s.budgets.length
        ? Math.round((1 - excessBudgets / s.budgets.length) * 100)
        : null,
      explanation: "Доля категорий с бюджетом, в которых не превышен лимит.",
    },
  ];
  const available = components.filter((c) => c.value !== null);
  // Require at least a complete historical month and actual current income.
  const score =
    m.historyMonths > 0 && m.flow.incomeMinor > 0
      ? Math.round(
          available.reduce((n, c) => n + c.value!, 0) / available.length,
        )
      : null;
  return {
    currentMinor,
    previousMinor,
    previousEnd,
    categories,
    components,
    score,
    change: previousMinor
      ? ((currentMinor - previousMinor) / previousMinor) * 100
      : null,
    impulseMinor: sum(impulsive),
    impulseCount: impulsive.length,
    impulseRatio: currentMinor ? (sum(impulsive) / currentMinor) * 100 : 0,
  };
}

/** Scenario changes only discretionary estimates; obligations and reserves stay intact. */
export function simulateScenario(
  s: State,
  options: {
    incomeDeltaMinor: number;
    variableReductionPercent: number;
    purchaseMinor: number;
  },
  asOf = today(s.profile.timezone),
) {
  if (
    !Number.isSafeInteger(options.incomeDeltaMinor) ||
    !Number.isSafeInteger(options.purchaseMinor) ||
    options.purchaseMinor < 0 ||
    options.variableReductionPercent < 0 ||
    options.variableReductionPercent > 100
  )
    throw new Error("Проверьте параметры сценария");
  const base = forecast(s, 365, asOf),
    m = metrics(s, asOf);
  const savedDaily = Math.round(
    (m.dailyVariable * options.variableReductionPercent) / 100,
  );
  const points = base.points.map((p, i) => ({
    date: p.date,
    balance:
      p.balance +
      savedDaily * i +
      options.incomeDeltaMinor * Math.floor(i / 30) -
      options.purchaseMinor,
  }));
  if (points.some((p) => !Number.isSafeInteger(p.balance)))
    throw new Error("Слишком большие суммы сценария");
  return {
    base: base.end,
    end: points[points.length - 1].balance,
    delta: points[points.length - 1].balance - base.end,
    gap: points.find((p) => p.balance < 0),
    points,
    savedMonthly: savedDaily * 30,
    date: format(addDays(parseISO(asOf), 365), "yyyy-MM-dd"),
    confidence: base.confidence,
  };
}
