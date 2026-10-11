import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { behaviorProfile } from "./intelligence";
import { attentionItems } from "./attention";
import {
  budgetMetrics,
  forecast,
  metrics,
  occurrences,
  pendingSince,
} from "./finance";
import { today, type State } from "./model";
import {
  defaultNoticePreferences,
  type Notice,
  type NoticeKind,
} from "./notification-model";
export {
  defaultNoticePreferences,
  noticeKinds,
  type Notice,
  type NoticeKind,
} from "./notification-model";
export const labels: Record<NoticeKind, string> = {
  payments: "Платежи и ожидаемые доходы",
  budgets: "Лимиты бюджета",
  cashflow: "Остаток и риск нехватки денег",
  goals: "Прогресс и сроки целей",
  review: "Проверка операций",
  habits: "Напоминание о ведении финансов",
  summary: "Итоги месяца",
  spending: "Необычный рост расходов",
};
export function inQuietHours(hour: number, start: number, end: number) {
  return start === end
    ? false
    : start < end
      ? hour >= start && hour < end
      : hour >= start || hour < end;
}
export function notifications(
  s: State,
  asOf = today(s.profile.timezone),
): Notice[] {
  const prefs = s.noticePreferences ?? defaultNoticePreferences;
  if (!prefs.enabled) return [];
  const list: Notice[] = [];
  const push = (n: Omit<Notice, "date">) => {
    if (prefs.kinds[n.kind]) list.push({ ...n, date: asOf });
  };
  const end = format(addDays(parseISO(asOf), prefs.leadDays), "yyyy-MM-dd");
  const expected = occurrences(s, pendingSince(s, asOf), end);
  // One reminder per occurrence/stage; old overdue occurrences are grouped to avoid a flood.
  const overdue = expected.filter((o) => o.date < asOf);
  if (overdue.length)
    push({
      id: `overdue:${overdue
        .map((o) => o.key)
        .sort()
        .join("|")
        .slice(0, 240)}`,
      kind: "payments",
      title: `Ожидают подтверждения: ${overdue.length}`,
      body: "Есть просроченные ожидаемые операции. Подтвердите факт оплаты или пропустите платёж в плане. Баланс пока не изменён.",
      href: "/plan",
      priority: "warning",
    });
  for (const o of expected.filter((o) => o.date >= asOf))
    push({
      id: `payment:${o.key}:${o.date === asOf ? "today" : "soon"}`,
      kind: "payments",
      title:
        o.date === asOf
          ? "Ожидаемая операция сегодня"
          : "Приближается ожидаемая операция",
      body: `${o.template.name} · ${o.date}. ${o.template.type === "income" ? "Доход ещё не получен. Подтвердите поступление в плане." : "Проверьте счёт и подтвердите оплату после списания."}`,
      href: "/plan",
      priority: o.date === asOf ? "warning" : "info",
    });
  const m = metrics(s, asOf),
    month = asOf.slice(0, 7);
  for (const b of s.budgets) {
    const p = budgetMetrics(s, b, asOf),
      name =
        s.categories.find((c) => c.id === b.categoryId)?.name ?? "Категория";
    const stage =
      p.usage >= 1
        ? "over"
        : p.usage >= 0.8
          ? "near"
          : p.willExceed && Number(asOf.slice(8)) >= 7 && p.usage >= 0.3
            ? "pace"
            : null;
    if (stage)
      push({
        id: `budget:${b.id}:${month}:${stage}`,
        kind: "budgets",
        title:
          stage === "over"
            ? "Лимит бюджета достигнут"
            : stage === "near"
              ? "Бюджет почти использован"
              : "Темп расходов выше плана",
        body: `${name}: использовано ${Math.round(p.usage * 100)}% месячного лимита. Проверьте расходы и доступный остаток бюджета.`,
        href: "/plan",
        priority: stage === "over" ? "warning" : "info",
      });
  }
  if (s.accounts.length) {
    const f = forecast(s, 30, asOf);
    if (f.gap)
      push({
        id: `cashgap:${month}`,
        kind: "cashflow",
        title: "Возможна нехватка денег",
        body: `Базовый прогноз показывает отрицательный остаток ${f.gap.date}. Уверенность: ${f.confidence.toLowerCase()}. Проверьте платежи и перенесите необязательные покупки. Это оценка, а не гарантированный результат.`,
        href: "/plan",
        priority: "critical",
      });
    else if (m.safe === 0 && m.liquid > 0)
      push({
        id: `reserve:${month}`,
        kind: "cashflow",
        title: "Свободные деньги уже распределены",
        body: "Обязательства, цели и финансовая подушка покрывают доступный остаток. Проверьте расчёт перед новой покупкой.",
        href: "/plan#safe-to-spend",
        priority: "warning",
      });
  }
  for (const g of s.goals.filter((g) => !g.archived)) {
    const ratio = g.savedMinor / g.targetMinor,
      days = differenceInCalendarDays(parseISO(g.date), parseISO(asOf)),
      stage =
        ratio >= 1
          ? "done"
          : days < 0
            ? "late"
            : days <= 7
              ? "due"
              : ratio >= 0.9
                ? "near"
                : null;
    if (stage)
      push({
        id: `goal:${g.id}:${stage}:${stage === "due" || stage === "late" ? g.date : ""}`,
        kind: "goals",
        title:
          stage === "done"
            ? "Финансовая цель достигнута"
            : stage === "late"
              ? "Срок цели уже прошёл"
              : stage === "due"
                ? "Приближается срок цели"
                : "До цели осталось совсем немного",
        body: `${g.name}: накоплено ${Math.round(ratio * 100)}%. ${stage === "done" ? "Можно выбрать следующую цель." : "Проверьте размер взноса и при необходимости измените срок."}`,
        href: "/goals",
        priority:
          stage === "done" ? "good" : stage === "late" ? "warning" : "info",
      });
  }
  if (prefs.kinds.spending && Number(asOf.slice(8)) >= 7) {
    const growth = behaviorProfile(s, asOf)
      .categories.filter(
        (c) =>
          c.growth !== null &&
          c.growth > 25 &&
          c.previousMinor > 0 &&
          c.difference >= Math.max(10000, m.flow.expensesMinor * 0.05),
      )
      .slice(0, 3);
    for (const c of growth)
      push({
        id: `spending:${c.id}:${month}`,
        kind: "spending",
        title: "Расходы в категории заметно выросли",
        body: `${c.name}: на ${Math.round(c.growth!)}% больше, чем за сопоставимые дни прошлого месяца. Проверьте крупные покупки: рост может быть запланированным.`,
        href: "/analytics",
        priority: "info",
      });
  }
  const attention = attentionItems(s, asOf).filter((i) => i.kind !== "payment");
  for (const kind of ["duplicate", "category", "recurring"] as const) {
    const items = attention.filter((i) => i.kind === kind);
    if (items.length)
      push({
        id: `review:${kind}:${month}`,
        kind: "review",
        title:
          kind === "duplicate"
            ? "Проверьте возможные дубли"
            : kind === "category"
              ? "Некоторым операциям нужна категория"
              : "Найдены похожие ежемесячные операции",
        body: `Требуют внимания: ${items.length}. ${kind === "recurring" ? "Можно создать регулярный шаблон после проверки." : "Проверка поможет сделать отчёты точнее."}`,
        href: "/profile#attention",
        priority: kind === "duplicate" ? "warning" : "info",
      });
  }
  const dates = s.transactions
      .map((t) => t.date)
      .filter((d) => d <= asOf)
      .sort(),
    last = dates.at(-1);
  if (last && differenceInCalendarDays(parseISO(asOf), parseISO(last)) >= 3)
    push({
      id: `habit:${last}`,
      kind: "habits",
      title: "Давно не обновляли операции",
      body: "Проверьте последние покупки и поступления. Если новых операций не было, ничего добавлять не нужно.",
      href: "/transactions",
      priority: "info",
    });
  if (
    Number(asOf.slice(8)) <= 7 &&
    s.transactions.some((t) => t.date < month + "-01")
  )
    push({
      id: `summary:${month}`,
      kind: "summary",
      title: "Можно подвести итоги прошлого месяца",
      body: "Откройте аналитику и выберите прошлый месяц: сравните доходы, расходы и категории, чтобы скорректировать план.",
      href: "/analytics",
      priority: "info",
    });
  return list
    .sort(
      (a, b) =>
        ["critical", "warning", "good", "info"].indexOf(a.priority) -
        ["critical", "warning", "good", "info"].indexOf(b.priority),
    )
    .slice(0, 100);
}
export function visibleNotices(s: State, now = new Date()) {
  const day = today(s.profile.timezone, now);
  return notifications(s, day).filter(
    (n) =>
      !s.noticeStates?.[n.id]?.dismissed &&
      (!s.noticeStates?.[n.id]?.snoozedUntil ||
        s.noticeStates[n.id].snoozedUntil! <= day),
  );
}
