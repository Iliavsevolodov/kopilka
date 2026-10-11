import { z } from "zod";
export const noticeKinds = [
  "payments",
  "budgets",
  "cashflow",
  "goals",
  "review",
  "habits",
  "summary",
  "spending",
] as const;
export type NoticeKind = (typeof noticeKinds)[number];
export const noticePreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  kinds: z.object({
    payments: z.boolean(),
    budgets: z.boolean(),
    cashflow: z.boolean(),
    goals: z.boolean(),
    review: z.boolean(),
    habits: z.boolean(),
    summary: z.boolean(),
    spending: z.boolean().default(true),
  }),
  reminderHour: z.number().int().min(0).max(23),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
  leadDays: z.number().int().min(1).max(7),
});
export const defaultNoticePreferences = {
  enabled: true,
  kinds: {
    payments: true,
    budgets: true,
    cashflow: true,
    goals: true,
    review: true,
    habits: false,
    summary: true,
    spending: true,
  },
  reminderHour: 10,
  quietStart: 22,
  quietEnd: 9,
  leadDays: 1,
};
export const noticeSchema = z.object({
  id: z.string().max(300),
  kind: z.enum(noticeKinds),
  title: z.string().max(200),
  body: z.string().max(600),
  href: z.string().max(300),
  date: z.string(),
  priority: z.enum(["info", "good", "warning", "critical"]),
});
export type Notice = z.infer<typeof noticeSchema>;
export const noticeStateSchema = z.object({
  read: z.boolean().optional(),
  dismissed: z.boolean().optional(),
  snoozedUntil: z.string().optional(),
});
