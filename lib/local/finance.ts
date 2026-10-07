import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  parseISO,
} from "date-fns";
import {
  calculateBudgetProjection,
  calculateCashFlow,
  calculateSafeToSpend,
  calculateSavingsRate,
} from "@/lib/finance/engine";
import {
  stateSchema,
  transactionSchema,
  type State,
  type Transaction,
  type Recurring,
  today,
} from "./model";
export function balances(s: State) {
  return s.accounts.map((a) => ({
    ...a,
    balanceMinor: s.transactions.reduce((n, t) => {
      if (t.accountId === a.id)
        n +=
          t.type === "income" || t.type === "adjustment"
            ? t.amountMinor
            : -t.amountMinor;
      if (t.type === "transfer" && t.destinationAccountId === a.id)
        n += t.amountMinor;
      return n;
    }, a.initialMinor),
  }));
}
export function validateTransaction(s: State, t: Transaction) {
  transactionSchema.parse(t);
  const a = s.accounts.find((a) => a.id === t.accountId && !a.archived);
  if (!a) throw new Error("Выберите доступный счёт");
  if (t.date > today(s.profile.timezone))
    throw new Error("Будущие платежи добавляйте в План");
  if (t.type === "transfer") {
    const b = s.accounts.find(
      (a) => a.id === t.destinationAccountId && !a.archived,
    );
    if (!b || b.id === a.id)
      throw new Error("Выберите другой счёт для перевода");
    if (a.currency !== b.currency)
      throw new Error("Переводы между разными валютами пока недоступны");
  } else if (
    t.type !== "adjustment" &&
    !s.categories.some((c) => c.id === t.categoryId && c.kind === t.type)
  )
    throw new Error("Выберите категорию операции");
  return t;
}
export function addTransaction(s: State, t: Transaction): State {
  validateTransaction(s, t);
  if (
    s.transactions.some(
      (x) =>
        x.id === t.id ||
        (!!t.recurringKey && x.recurringKey === t.recurringKey),
    )
  )
    return s;
  return { ...s, transactions: [t, ...s.transactions] };
}
export function validateState(s: State) {
  stateSchema.parse(s);
  for (const key of [
    "accounts",
    "categories",
    "transactions",
    "goals",
    "budgets",
    "recurring",
  ] as const) {
    const ids = s[key].map((x) => x.id);
    if (new Set(ids).size !== ids.length)
      throw new Error("Повторяющиеся идентификаторы");
  }
  for (const t of s.transactions) {
    validateTransaction(
      { ...s, accounts: s.accounts.map((a) => ({ ...a, archived: false })) },
      t,
    );
  }
  for (const r of s.recurring) {
    if (
      !s.accounts.some((a) => a.id === r.accountId) ||
      !s.categories.some((c) => c.id === r.categoryId && c.kind === r.type)
    )
      throw new Error("Некорректный шаблон платежа");
  }
  for (const b of s.budgets)
    if (
      !s.categories.some((c) => c.id === b.categoryId && c.kind === "expense")
    )
      throw new Error("Некорректная категория бюджета");
  for (const a of balances(s))
    if (!Number.isSafeInteger(a.balanceMinor))
      throw new Error("Баланс превышает допустимый диапазон");
  return s;
}
export function occurrences(s: State, from: string, to: string) {
  const list: { template: Recurring; date: string; key: string }[] = [];
  for (const r of s.recurring.filter((r) => r.active)) {
    let month = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
    const end = new Date(`${to}T23:59:59Z`);
    while (month <= end) {
      const year = month.getUTCFullYear(),
        m = month.getUTCMonth();
      const d = Math.min(
        r.day,
        new Date(Date.UTC(year, m + 1, 0)).getUTCDate(),
      );
      const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const key = `${r.id}:${date}`;
      if (
        date >= from &&
        date <= to &&
        date >= r.startDate &&
        !s.resolved.includes(key) &&
        !s.transactions.some((t) => t.recurringKey === key)
      )
        list.push({ template: r, date, key });
      month = new Date(Date.UTC(year, m + 1, 1, 12));
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
export function confirmRecurring(
  s: State,
  key: string,
  now = today(s.profile.timezone),
): State {
  const split = key.lastIndexOf(":");
  const date = key.slice(split + 1);
  const r = s.recurring.find((r) => r.id === key.slice(0, split));
  if (!r || !r.active || date > now)
    throw new Error("Подтверждение доступно в день платежа");
  if (s.resolved.includes(key)) return s;
  if (!occurrences(s, date, date).some((o) => o.key === key))
    throw new Error("Платёж уже обработан");
  return {
    ...addTransaction(s, {
      id: key,
      type: r.type,
      amountMinor: r.amountMinor,
      accountId: r.accountId,
      categoryId: r.categoryId,
      date,
      description: r.name,
      mandatory: r.mandatory,
      impulsive: false,
      source: "recurring",
      recurringKey: key,
      createdAt: new Date().toISOString(),
    }),
    resolved: [...s.resolved, key],
  };
}
export function pendingSince(s: State, asOf = today(s.profile.timezone)) {
  return s.recurring
    .filter((r) => r.active)
    .reduce(
      (earliest, r) => (r.startDate < earliest ? r.startDate : earliest),
      asOf,
    );
}
function liquidAccount(s: State, accountId: string) {
  return s.accounts.some(
    (a) =>
      a.id === accountId &&
      a.includeInTotal &&
      a.currency === s.profile.currency &&
      !["deposit", "investment"].includes(a.type),
  );
}
export function metrics(s: State, asOf = today(s.profile.timezone)) {
  const accounts = balances(s),
    included = accounts.filter(
      (a) => a.includeInTotal && a.currency === s.profile.currency,
    );
  const total = included.reduce((n, a) => n + a.balanceMinor, 0),
    liquid = included
      .filter((a) => !["deposit", "investment"].includes(a.type))
      .reduce((n, a) => n + a.balanceMinor, 0);
  const currencyTx = s.transactions.filter(
    (t) =>
      s.accounts.find((a) => a.id === t.accountId)?.currency ===
      s.profile.currency,
  );
  const monthTx = currencyTx.filter(
    (t) => t.date.slice(0, 7) === asOf.slice(0, 7),
  );
  const flow = calculateCashFlow(monthTx);
  const monthStart = asOf.slice(0, 7) + "-01";
  const history = currencyTx.filter((t) => t.date < monthStart);
  const months = Math.max(
    1,
    ...history.map((t) =>
      differenceInCalendarMonths(parseISO(monthStart), parseISO(t.date)),
    ),
  );
  const mandatoryHistory = history
    .filter((t) => t.type === "expense" && t.mandatory)
    .reduce((n, t) => n + t.amountMinor, 0);
  const mandatory = Math.max(
    s.profile.mandatoryMinor,
    Math.round(mandatoryHistory / months),
  );
  const variableHistory = history
    .filter((t) => t.type === "expense" && !t.recurringKey && !t.mandatory)
    .reduce((n, t) => n + t.amountMinor, 0);
  const dailyVariable = history.length
    ? Math.round(variableHistory / (months * 30.44))
    : Math.round(
        (Math.max(0, s.profile.monthlyIncomeMinor - s.profile.mandatoryMinor) *
          0.5) /
          30.44,
      );
  const end = format(addDays(parseISO(asOf), 30), "yyyy-MM-dd");
  const expected = occurrences(s, pendingSince(s, asOf), end).filter((o) =>
    liquidAccount(s, o.template.accountId),
  );
  const nextIncome =
    expected.find((o) => o.template.type === "income" && o.date >= asOf)
      ?.date ?? end;
  const obligations = expected
    .filter(
      (o) =>
        o.template.type === "expense" &&
        o.template.mandatory &&
        o.date <= nextIncome,
    )
    .reduce((n, o) => n + o.template.amountMinor, 0);
  const reserved = s.goals
    .filter((g) => !g.archived)
    .reduce((n, g) => n + g.savedMinor, 0);
  const reserve = Math.round(mandatory * s.profile.reserveMonths);
  const safe = calculateSafeToSpend({
    liquidBalanceMinor: liquid,
    obligationsUntilNextIncomeMinor: obligations,
    reservedGoalMoneyMinor: reserved,
    minimumEmergencyReserveMinor: reserve,
  });
  const savings = included
    .filter((a) => a.type === "savings")
    .reduce((n, a) => n + a.balanceMinor, 0);
  const categories = s.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      ...c,
      amount: monthTx
        .filter((t) => t.type === "expense" && t.categoryId === c.id)
        .reduce((n, t) => n + t.amountMinor, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return {
    accounts,
    total,
    liquid,
    flow,
    rate: calculateSavingsRate(flow.incomeMinor, flow.expensesMinor),
    safe,
    reserve,
    reserved,
    obligations,
    mandatory,
    savings,
    cushion: mandatory ? savings / mandatory : 0,
    dailyVariable,
    historyMonths: history.length ? months : 0,
    categories,
    monthTx,
    currencyTx,
  };
}
export function forecast(
  s: State,
  days: number,
  asOf = today(s.profile.timezone),
  scenario: "base" | "careful" | "optimistic" = "base",
) {
  const m = metrics(s, asOf),
    end = format(addDays(parseISO(asOf), days), "yyyy-MM-dd");
  const expected = occurrences(s, pendingSince(s, asOf), end).filter((o) =>
    liquidAccount(s, o.template.accountId),
  );
  // Reserve untemplated mandatory spending as well; recurring facts never enter variable expenses twice.
  const recurringMandatory = s.recurring
    .filter(
      (r) =>
        r.active &&
        r.type === "expense" &&
        r.mandatory &&
        s.accounts.find((a) => a.id === r.accountId)?.currency ===
          s.profile.currency,
    )
    .reduce((n, r) => n + r.amountMinor, 0);
  const daily =
    m.dailyVariable +
    Math.round(Math.max(0, m.mandatory - recurringMandatory) / 30.44);
  let balance = m.liquid;
  const points = [{ date: asOf, balance }];
  for (let i = 1; i <= days; i++) {
    const date = format(addDays(parseISO(asOf), i), "yyyy-MM-dd");
    const items = expected.filter(
      (o) =>
        o.date === date ||
        (i === 1 &&
          o.date <= asOf &&
          (o.template.type === "expense" || o.date === asOf)),
    );
    balance +=
      items.reduce(
        (n, o) =>
          n +
          (o.template.type === "income"
            ? Math.round(
                o.template.amountMinor * (scenario === "careful" ? 0.9 : 1),
              )
            : -o.template.amountMinor),
        0,
      ) -
      Math.round(
        daily *
          (scenario === "careful" ? 1.2 : scenario === "optimistic" ? 0.85 : 1),
      );
    points.push({ date, balance });
  }
  return {
    points,
    end: balance,
    gap: points.find((p) => p.balance < 0),
    confidence:
      m.historyMonths >= 12
        ? "Высокая"
        : m.historyMonths >= 3
          ? "Средняя"
          : "Низкая",
    months: m.historyMonths,
  };
}
export function budgetMetrics(
  s: State,
  b: State["budgets"][number],
  asOf = today(s.profile.timezone),
) {
  const m = metrics(s, asOf);
  const spentMinor = m.monthTx
    .filter((t) => t.type === "expense" && t.categoryId === b.categoryId)
    .reduce((n, t) => n + t.amountMinor, 0);
  const d = parseISO(asOf);
  return {
    ...calculateBudgetProjection({
      spentMinor,
      budgetMinor: b.limitMinor,
      elapsedDays: d.getDate(),
      totalDays: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    }),
    spentMinor,
  };
}
export function goalMonthly(
  target: number,
  saved: number,
  date: string,
  asOf: string,
) {
  const months = Math.max(
    1,
    differenceInCalendarMonths(parseISO(date), parseISO(asOf)),
  );
  return Math.ceil(Math.max(0, target - saved) / months);
}
export function historyPoints(
  s: State,
  days: number,
  asOf = today(s.profile.timezone),
) {
  const m = metrics(s, asOf);
  return Array.from({ length: days }, (_, i) => {
    const date = format(addDays(parseISO(asOf), i - days + 1), "yyyy-MM-dd");
    const after = s.transactions.filter((t) => t.date > date);
    let balance = m.total;
    for (const t of after) {
      const a = s.accounts.find((a) => a.id === t.accountId);
      const b = s.accounts.find((a) => a.id === t.destinationAccountId);
      if (a?.includeInTotal && a.currency === s.profile.currency)
        balance -=
          t.type === "income" || t.type === "adjustment"
            ? t.amountMinor
            : -t.amountMinor;
      if (
        t.type === "transfer" &&
        b?.includeInTotal &&
        b.currency === s.profile.currency
      )
        balance -= t.amountMinor;
    }
    return { date, balance };
  });
}
export function insights(s: State, asOf = today(s.profile.timezone)) {
  const m = metrics(s, asOf);
  const list: {
    title: string;
    description: string;
    kind: "good" | "warning" | "info";
    href: string;
  }[] = [];
  const f = forecast(s, 30, asOf);
  if (f.gap)
    list.push({
      title: "Возможен кассовый разрыв",
      description: `Прогноз уходит ниже нуля ${f.gap.date}. Проверьте ближайшие платежи и отложите необязательные покупки.`,
      kind: "warning",
      href: "/plan",
    });
  for (const b of s.budgets) {
    const p = budgetMetrics(s, b, asOf);
    if (p.willExceed)
      list.push({
        title: `Бюджет: ${s.categories.find((c) => c.id === b.categoryId)?.name}`,
        description:
          "При текущем темпе расходы превысят лимит. Уменьшите ежедневные траты в этой категории.",
        kind: "warning",
        href: "/plan",
      });
  }
  if (m.flow.incomeMinor > 0 && m.rate >= 20)
    list.push({
      title: "Вы оставляете деньги на будущее",
      description: `За этот месяц сохранено ${m.rate.toFixed(1)}% дохода. Распределите свободные деньги между целями и резервом.`,
      kind: "good",
      href: "/goals",
    });
  if (!list.length)
    list.push({
      title: m.historyMonths
        ? "Ваш план под контролем"
        : "Знакомимся с вашими финансами",
      description: m.historyMonths
        ? "Сверяйте ожидаемые платежи с фактическими операциями, чтобы прогноз оставался полезным."
        : "Добавляйте операции и регулярные платежи. По мере накопления истории прогноз станет точнее.",
      kind: "info",
      href: "/plan",
    });
  return list.slice(0, 3);
}
export function purchaseImpact(s: State, cost: number, date: string) {
  const days = Math.min(
    365,
    Math.max(
      0,
      differenceInCalendarDays(
        parseISO(date),
        parseISO(today(s.profile.timezone)),
      ),
    ),
  );
  const f = forecast(s, Math.max(days, 30));
  const m = metrics(s);
  const at = f.points[days]?.balance ?? m.liquid;
  const minimum = Math.min(
    ...f.points.slice(days).map((p) => p.balance - cost),
  );
  return {
    remaining: at - cost,
    reserveMonths: m.mandatory
      ? Math.max(0, at - cost - m.reserved) / m.mandatory
      : 0,
    status:
      minimum < 0
        ? "Высокий финансовый риск"
        : at - cost < m.reserve + m.reserved
          ? "Покупка затронет резерв или цели"
          : "Можно позволить",
    safe: minimum >= 0 && at - cost >= m.reserve + m.reserved,
  };
}
