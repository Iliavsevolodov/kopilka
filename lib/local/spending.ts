import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { metrics, occurrences, pendingSince } from "./finance";
import { today, type State } from "./model";
export function spendingPlan(
  s: State,
  until?: string,
  asOf = today(s.profile.timezone),
) {
  const m = metrics(s, asOf),
    end = until || m.nextIncome;
  const days = Math.max(
    0,
    differenceInCalendarDays(parseISO(end), parseISO(asOf)),
  );
  const expected = occurrences(s, pendingSince(s, asOf), end).filter((o) =>
    s.accounts.some(
      (a) =>
        a.id === o.template.accountId &&
        a.includeInTotal &&
        a.currency === s.profile.currency &&
        !["deposit", "investment"].includes(a.type),
    ),
  );
  const payments = expected.filter((o) => o.template.type === "expense");
  const obligations = payments
    .filter((o) => o.template.mandatory)
    .reduce((n, o) => n + o.template.amountMinor, 0);
  const regularOther = payments
    .filter((o) => !o.template.mandatory)
    .reduce((n, o) => n + o.template.amountMinor, 0);
  const mandatoryMonthly = s.recurring
    .filter(
      (r) =>
        r.active &&
        r.type === "expense" &&
        r.mandatory &&
        s.accounts.some(
          (a) => a.id === r.accountId && a.currency === s.profile.currency,
        ),
    )
    .reduce((n, r) => n + r.amountMinor, 0);
  const unplannedMandatory = Math.round(
    (Math.max(0, m.mandatory - mandatoryMonthly) * days) / 30.44,
  );
  const ordinary =
    Math.round(m.dailyVariable * days) + regularOther + unplannedMandatory;
  const safe = Math.max(0, m.liquid - obligations - m.reserved - m.reserve);
  const free = Math.max(0, safe - ordinary);
  const expectedIncome = expected
    .filter((o) => o.template.type === "income" && o.date >= asOf)
    .reduce((n, o) => n + o.template.amountMinor, 0);
  return {
    ...m,
    end,
    days,
    payments,
    obligations,
    ordinary,
    safe,
    free,
    expectedIncome,
    projected: m.liquid + expectedIncome - obligations - ordinary,
    maxDate: format(addDays(parseISO(asOf), 365), "yyyy-MM-dd"),
  };
}
