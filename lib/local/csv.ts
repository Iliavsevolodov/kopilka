import { parseMajorToMinor } from "@/lib/finance/money";
import { dateSchema, today, type State, type Transaction } from "./model";
import { duplicateOf, parseTags } from "./ledger";
import { addTransaction } from "./finance";
export type CsvMap = {
  currency: number;
  date: number;
  amount: number;
  type: number;
  category: number;
  description: number;
  merchant: number;
  tags: number;
  externalId: number;
};
/** RFC-style quoted cells, escaped quotes and embedded newlines; no eval or formula execution. */
export function parseCsv(text: string, delimiter?: string) {
  if (text.length > 1_000_000)
    throw new Error("Максимальный размер CSV — 1 МБ");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const sep =
    delimiter ??
    [";", ",", "\t"].sort(
      (a, b) => first.split(b).length - first.split(a).length,
    )[0];
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) quoted = false;
      else if (!cell) quoted = true;
      else throw new Error("Некорректные кавычки в CSV");
    } else if (c === sep && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("В CSV не закрыты кавычки");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2)
    throw new Error("Нужны строка заголовков и хотя бы одна операция");
  if (rows.length > 2001)
    throw new Error("Импортируйте не более 2000 операций за один раз");
  return { headers: rows[0], rows: rows.slice(1) };
}
export function guessMap(headers: string[]): CsvMap {
  const find = (names: string[]) =>
    headers.findIndex((h) => names.includes(h.trim().toLowerCase()));
  return {
    currency: find(["валюта", "currency"]),
    date: find(["дата", "date"]),
    amount: find(["сумма", "amount"]),
    type: find(["тип", "тип операции", "type"]),
    category: find(["категория", "category"]),
    description: find(["описание", "комментарий", "description"]),
    merchant: find(["магазин", "получатель", "merchant"]),
    tags: find(["теги", "tags"]),
    externalId: find(["id", "external_id", "идентификатор"]),
  };
}
export type ImportRow = {
  line: number;
  transaction?: Transaction;
  error?: string;
  duplicate: boolean;
  needsCategory: boolean;
};
export function previewCsv(
  s: State,
  rows: string[][],
  map: CsvMap,
  accountId: string,
  batchId: string,
): ImportRow[] {
  const staged: Transaction[] = [];
  return rows.map((row, i) => {
    try {
      const get = (key: keyof CsvMap) => (row[map[key]] ?? "").trim();
      let date = get("date");
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(date))
        date = date.split(".").reverse().join("-");
      if (
        !dateSchema.safeParse(date).success ||
        date > today(s.profile.timezone)
      )
        throw new Error(
          "Нужна прошедшая дата в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ",
        );
      const currency = get("currency");
      if (
        currency &&
        currency !== s.accounts.find((a) => a.id === accountId)?.currency
      )
        throw new Error("Валюта строки не совпадает с выбранным счётом");
      const amount = parseMajorToMinor(
        get("amount").replace(/[\s\u00a0]/g, ""),
      );
      if (amount === 0) throw new Error("Сумма не может быть нулевой");
      const raw = get("type").toLowerCase();
      if (raw && !["income", "expense", "доход", "расход"].includes(raw))
        throw new Error(
          "Импорт поддерживает доходы и расходы; переводы и возвраты внесите отдельно",
        );
      const type = (raw ? ["income", "доход"].includes(raw) : amount > 0)
        ? "income"
        : "expense";
      const cat = s.categories.find(
        (c) =>
          !c.archived &&
          c.kind === type &&
          c.name.toLowerCase() === get("category").toLowerCase(),
      );
      const fallback =
        s.categories.find(
          (c) => c.kind === type && c.name === "Другое" && !c.archived,
        ) ?? s.categories.find((c) => c.kind === type && !c.archived);
      if (!fallback && !cat)
        throw new Error("Создайте категорию для этого типа операций");
      const t: Transaction = {
        id: `${batchId}-${i}`,
        date,
        type,
        amountMinor: Math.abs(amount),
        accountId,
        categoryId: (cat ?? fallback)!.id,
        description: get("description"),
        merchant: get("merchant"),
        tags: parseTags(get("tags")),
        needsReview: !cat,
        externalId: get("externalId") || undefined,
        importBatchId: batchId,
        mandatory: false,
        impulsive: false,
        source: "csv",
        createdAt: new Date().toISOString(),
      };
      const duplicate = !!duplicateOf(
        { ...s, transactions: [...s.transactions, ...staged] },
        t,
      );
      addTransaction(s, t);
      staged.push(t);
      return { line: i + 2, transaction: t, duplicate, needsCategory: !cat };
    } catch (e) {
      return {
        line: i + 2,
        error:
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Проверьте длину описания, теги и сумму строки",
        duplicate: false,
        needsCategory: false,
      };
    }
  });
}
export function importRows(s: State, rows: ImportRow[], selected: Set<number>) {
  let next = s;
  for (const row of rows.filter((r) => selected.has(r.line))) {
    if (!row.transaction || row.error)
      throw new Error("Исправьте ошибочные строки");
    if (duplicateOf(next, row.transaction))
      throw new Error(
        "Обнаружен дубль. Пересмотрите предпросмотр и исключите повторяющуюся строку",
      );
    next = addTransaction(next, row.transaction);
  }
  return next;
}
