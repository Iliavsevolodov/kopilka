import type { State, Transaction } from "./model";

/** Cash entries are stored once. Reporting expands splits and nets refunds on their actual date. */
export function reportingEntries(s: State): Transaction[] {
  return s.transactions.flatMap((t) => {
    if (t.refundOf) {
      const original = s.transactions.find((x) => x.id === t.refundOf);
      return [
        {
          ...t,
          type: "expense" as const,
          amountMinor: -t.amountMinor,
          tags: original?.tags,
          merchant: original?.merchant,
          mandatory: original?.mandatory ?? false,
          impulsive: original?.impulsive ?? false,
        },
      ];
    }
    if (t.allocations?.length)
      return t.allocations.map((a) => ({ ...t, ...a, allocations: undefined }));
    return [t];
  });
}
export function allocatedAmounts(t: Transaction) {
  return (
    t.allocations ??
    (t.categoryId
      ? [{ categoryId: t.categoryId, amountMinor: t.amountMinor }]
      : [])
  );
}
export function refundable(s: State, t: Transaction, categoryId: string) {
  return (
    allocatedAmounts(t)
      .filter((a) => a.categoryId === categoryId)
      .reduce((n, a) => n + a.amountMinor, 0) -
    s.transactions
      .filter((r) => r.refundOf === t.id && r.categoryId === categoryId)
      .reduce((n, r) => n + r.amountMinor, 0)
  );
}
export function validateLedgerEntry(s: State, t: Transaction) {
  if (t.allocations) {
    if (t.type !== "expense" || t.refundOf)
      throw new Error("Разделить можно только покупку");
    if (
      new Set(t.allocations.map((a) => a.categoryId)).size !==
      t.allocations.length
    )
      throw new Error("Объедините повторяющиеся категории");
    const sum = t.allocations.reduce((n, a) => n + a.amountMinor, 0);
    if (!Number.isSafeInteger(sum) || sum !== t.amountMinor)
      throw new Error("Сумма частей должна совпадать с суммой покупки");
    if (
      t.allocations.some(
        (a) =>
          !s.categories.some(
            (c) => c.id === a.categoryId && c.kind === "expense",
          ),
      )
    )
      throw new Error("Выберите категории расходов");
  }
  if (t.refundOf) {
    const original = s.transactions.find((x) => x.id === t.refundOf);
    if (
      !original ||
      original.type !== "expense" ||
      t.type !== "income" ||
      t.date < original.date
    )
      throw new Error(
        "Возврат должен быть связан с покупкой и не предшествовать ей",
      );
    if (
      s.accounts.find((a) => a.id === t.accountId)?.currency !==
      s.accounts.find((a) => a.id === original.accountId)?.currency
    )
      throw new Error("Валюта возврата должна совпадать с покупкой");
    const available = refundable(
      { ...s, transactions: s.transactions.filter((x) => x.id !== t.id) },
      original,
      t.categoryId ?? "",
    );
    if (t.amountMinor > available)
      throw new Error(
        "Возврат превышает невозвращённую сумму в этой категории",
      );
  }
}
export function duplicateOf(s: State, t: Transaction): Transaction | undefined {
  return s.transactions.find(
    (x) =>
      x.id !== t.id &&
      x.accountId === t.accountId &&
      ((t.externalId &&
        x.externalId === t.externalId &&
        x.source === t.source) ||
        (x.date === t.date &&
          x.amountMinor === t.amountMinor &&
          x.type === t.type &&
          !x.refundOf &&
          !t.refundOf &&
          (x.description || x.merchant || "").trim().toLowerCase() ===
            (t.description || t.merchant || "").trim().toLowerCase())),
  );
}
export function removeTransaction(s: State, id: string): State {
  if (s.transactions.some((t) => t.refundOf === id))
    throw new Error(
      "Сначала удалите связанные возвраты, затем исходную покупку",
    );
  const t = s.transactions.find((t) => t.id === id);
  return {
    ...s,
    transactions: s.transactions.filter((t) => t.id !== id),
    resolved: s.resolved.filter((k) => k !== t?.recurringKey),
  };
}
export const parseTags = (input: string) => [
  ...new Set(
    input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  ),
];
