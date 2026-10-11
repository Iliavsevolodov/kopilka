import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
  startOfQuarter,
  subMonths,
  subYears,
} from "date-fns";
import { calculateCashFlow } from "@/lib/finance/engine";
import { dateSchema, today, type State, type Transaction } from "./model";
import { reportingEntries } from "./ledger";
export type Period = "week" | "month" | "quarter" | "year" | "custom";
export type ReportFilter = {
  from: string;
  to: string;
  account: string;
  category: string;
  tag: string;
  merchant: string;
};
const day = (d: Date) => format(d, "yyyy-MM-dd");
export function periodRange(period: Period, asOf: string) {
  const d = parseISO(asOf);
  return {
    from:
      period === "week"
        ? day(startOfWeek(d, { weekStartsOn: 1 }))
        : period === "quarter"
          ? day(startOfQuarter(d))
          : period === "year"
            ? asOf.slice(0, 4) + "-01-01"
            : asOf.slice(0, 7) + "-01",
    to: asOf,
  };
}
export function priorRange(period: Period, from: string, to: string) {
  const shift = (s: string) =>
    day(
      period === "month"
        ? subMonths(parseISO(s), 1)
        : period === "quarter"
          ? subMonths(parseISO(s), 3)
          : period === "year"
            ? subYears(parseISO(s), 1)
            : addDays(
                parseISO(s),
                -differenceInCalendarDays(parseISO(to), parseISO(from)) - 1,
              ),
    );
  return { from: shift(from), to: shift(to) };
}
export function validRange(from: string, to: string) {
  return (
    dateSchema.safeParse(from).success &&
    dateSchema.safeParse(to).success &&
    from <= to &&
    differenceInCalendarDays(parseISO(to), parseISO(from)) <= 3660
  );
}
export function matches(t: Transaction, f: ReportFilter) {
  return (
    t.date >= f.from &&
    t.date <= f.to &&
    (!f.account || t.accountId === f.account) &&
    (!f.category || t.categoryId === f.category) &&
    (!f.tag || t.tags?.includes(f.tag)) &&
    (!f.merchant || t.merchant === f.merchant)
  );
}
export function report(s: State, f: ReportFilter) {
  const entries = reportingEntries(s).filter(
    (t) =>
      s.accounts.find((a) => a.id === t.accountId)?.currency ===
        s.profile.currency && matches(t, f),
  );
  const flow = calculateCashFlow(entries);
  const categories = s.categories
    .map((c) => ({
      ...c,
      amount: entries
        .filter((t) => t.categoryId === c.id && t.type === c.kind)
        .reduce((n, t) => n + t.amountMinor, 0),
    }))
    .filter((c) => c.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
  const groups = new Map<string, { income: number; expense: number }>();
  for (const t of entries) {
    const key = t.date.slice(0, 7),
      v = groups.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "income") v.income += t.amountMinor;
    if (t.type === "expense") v.expense += t.amountMinor;
    groups.set(key, v);
  }
  const flows = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
  const byDate = new Map<string, number>();
  for (const t of entries)
    if (t.type === "expense")
      byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amountMinor);
  return { entries, flow, categories, flows, byDate };
}
export function transactionsHref(f: Partial<ReportFilter>) {
  return `/transactions?${new URLSearchParams(Object.entries(f).filter(([, v]) => !!v))}`;
}
export function defaultFilter(asOf = today()): ReportFilter {
  return {
    ...periodRange("month", asOf),
    account: "",
    category: "",
    tag: "",
    merchant: "",
  };
}
