import {
  addMonths,
  format,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import { duplicateOf } from "./ledger";
import { occurrences, pendingSince } from "./finance";
import { today, type State, type Transaction } from "./model";
export type AttentionItem = {
  id: string;
  kind: "payment" | "category" | "duplicate" | "recurring";
  title: string;
  description: string;
  transaction?: Transaction;
  key?: string;
};
export function attentionItems(
  s: State,
  asOf = today(s.profile.timezone),
): AttentionItem[] {
  const items: AttentionItem[] = occurrences(
    s,
    pendingSince(s, asOf),
    asOf,
  ).map((o) => ({
    id: `payment:${o.key}`,
    kind: "payment",
    title: o.template.name,
    description: `Платёж на ${o.date}: подтвердите факт или пропустите в плане.`,
    key: o.key,
  }));
  const seen = new Set<string>(),
    groups = new Map<string, Transaction[]>();
  for (const t of s.transactions) {
    if ((t.type === "expense" || t.type === "income") && !t.refundOf) {
      if (
        t.needsReview ||
        (!t.allocations &&
          s.categories.find((c) => c.id === t.categoryId)?.name === "Другое")
      )
        items.push({
          id: `category:${t.id}`,
          kind: "category",
          title: "Уточните категорию",
          description: t.description || t.merchant || t.date,
          transaction: t,
        });
      const duplicate = duplicateOf(s, t);
      if (duplicate) {
        const pair = [t.id, duplicate.id].sort().join(":");
        if (!seen.has(pair)) {
          items.push({
            id: `duplicate:${pair}`,
            kind: "duplicate",
            title: "Возможный дубль",
            description: `Совпали дата, счёт, сумма и описание: ${t.description || t.date}. Проверьте обе записи, прежде чем удалять.`,
            transaction: t,
          });
          seen.add(pair);
        }
      }
      const name = (t.merchant || t.description).trim().toLowerCase();
      if (name && !t.recurringKey && !t.allocations) {
        const key = [t.accountId, t.type, t.categoryId, name].join("|");
        groups.set(key, [...(groups.get(key) ?? []), t]);
      }
    }
  }
  for (const [key, group] of groups) {
    const sorted = group.sort((a, b) => b.date.localeCompare(a.date)),
      last = sorted[0];
    if (
      sorted.length < 3 ||
      differenceInCalendarDays(parseISO(asOf), parseISO(last.date)) > 45
    )
      continue;
    const sample = sorted.slice(0, 3);
    if (
      sample.slice(1).every((t, i) => {
        const gap = differenceInCalendarDays(
          parseISO(sample[i].date),
          parseISO(t.date),
        );
        return (
          gap >= 25 &&
          gap <= 35 &&
          Math.abs(t.amountMinor - last.amountMinor) / last.amountMinor <= 0.15
        );
      }) &&
      !s.recurring.some(
        (r) =>
          r.active &&
          r.accountId === last.accountId &&
          r.type === last.type &&
          r.categoryId === last.categoryId &&
          (r.name.toLowerCase() ===
            (last.merchant || last.description).toLowerCase() ||
            r.amountMinor === last.amountMinor),
      )
    )
      items.push({
        id: `recurring:${key}`,
        kind: "recurring",
        title: "Повторяющийся платёж?",
        description: `Найдено 3 похожих операции примерно раз в месяц: ${last.merchant || last.description}. Проверьте сумму и дату перед созданием шаблона.`,
        transaction: last,
      });
  }
  return items.filter((i) => !s.dismissedAttention?.includes(i.id));
}
export function suggestedNextDate(t: Transaction) {
  return format(addMonths(parseISO(t.date), 1), "yyyy-MM-dd");
}
