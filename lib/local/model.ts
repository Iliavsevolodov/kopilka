import { z } from "zod";
import { DEFAULT_CATEGORIES } from "@/lib/domain/categories";
const money = z.number().int().safe();
const positive = money.positive();
export const currencySchema = z.enum(["RUB", "USD", "EUR"]);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Некорректная дата",
  );
const id = z.string().min(1).max(100);
export const accountSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  type: z.enum([
    "card",
    "cash",
    "savings",
    "deposit",
    "investment",
    "wallet",
    "other",
  ]),
  initialMinor: money,
  currency: currencySchema,
  includeInTotal: z.boolean(),
  archived: z.boolean().default(false),
  color: z.string().default("#147d64"),
});
export const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  icon: z.string().max(10),
  kind: z.enum(["income", "expense"]),
  archived: z.boolean().default(false),
});
export const transactionSchema = z
  .object({
    id,
    type: z.enum(["income", "expense", "transfer", "adjustment"]),
    amountMinor: money,
    accountId: id,
    destinationAccountId: id.optional(),
    categoryId: id.optional(),
    date: dateSchema,
    description: z.string().max(300),
    mandatory: z.boolean(),
    impulsive: z.boolean(),
    source: z.enum(["manual", "demo", "recurring"]),
    recurringKey: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().optional(),
  })
  .refine(
    (t) => (t.type === "adjustment" ? t.amountMinor !== 0 : t.amountMinor > 0),
    "Сумма должна быть больше нуля",
  );
export const recurringSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  type: z.enum(["income", "expense"]),
  amountMinor: positive,
  accountId: id,
  categoryId: id,
  day: z.number().int().min(1).max(31),
  startDate: dateSchema,
  active: z.boolean(),
  mandatory: z.boolean(),
});
export const goalSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    targetMinor: positive,
    savedMinor: money.nonnegative(),
    date: dateSchema,
    icon: z.string().max(10),
    archived: z.boolean().default(false),
  })
  .refine((g) => g.savedMinor <= g.targetMinor, "Накоплено больше суммы цели");
export const budgetSchema = z.object({
  id,
  categoryId: id,
  limitMinor: positive,
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  currency: currencySchema,
  monthlyIncomeMinor: money.nonnegative(),
  mandatoryMinor: money.nonnegative(),
  reserveMonths: z.number().min(0).max(24),
  onboarded: z.boolean(),
  theme: z.enum(["system", "light", "dark"]),
  hidden: z.boolean(),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("ru", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
});
export const stateSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["personal", "demo"]),
  profile: profileSchema,
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  goals: z.array(goalSchema),
  recurring: z.array(recurringSchema),
  resolved: z.array(z.string()),
});
export type State = z.infer<typeof stateSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Recurring = z.infer<typeof recurringSchema>;
export const uid = () => crypto.randomUUID();
export function today(timezone = "Europe/Moscow", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function emptyState(): State {
  return {
    version: 1,
    mode: "personal",
    profile: {
      name: "",
      currency: "RUB",
      monthlyIncomeMinor: 0,
      mandatoryMinor: 0,
      reserveMonths: 3,
      onboarded: false,
      theme: "system",
      hidden: false,
      timezone: "Europe/Moscow",
    },
    accounts: [],
    categories: DEFAULT_CATEGORIES.map((c, i) => ({
      ...c,
      id: `cat-${i}`,
      archived: false,
    })),
    transactions: [],
    budgets: [],
    goals: [],
    recurring: [],
    resolved: [],
  };
}
