"use client";
import { useState } from "react";
import Link from "next/link";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { useFinance } from "./provider";
import { Money, SectionTitle, Empty } from "./ui";
import { BalanceChart, Donut, chartColors } from "./charts";
import { today } from "@/lib/local/model";
import {
  report,
  priorRange,
  defaultFilter,
  validRange,
  transactionsHref,
  type Period,
  type ReportFilter,
} from "@/lib/local/reports";
import { historyPoints, budgetMetrics } from "@/lib/local/finance";
import { ReportFilters } from "./report-filters";
import { Glyph } from "./glyph";

export function Analytics() {
  const { state } = useFinance();
  const [settings, setSettings] = useState<{
    filter: ReportFilter;
    period: Period;
  }>(() => {
    try {
      const raw = JSON.parse(
        sessionStorage.getItem(`kopilka.reports.${state.mode}`) || "null",
      );
      if (
        raw &&
        ["week", "month", "quarter", "year", "custom"].includes(raw.period) &&
        Object.values(raw.filter).every((v) => typeof v === "string") &&
        validRange(raw.filter.from, raw.filter.to)
      )
        return raw;
    } catch {}
    return {
      filter: defaultFilter(today(state.profile.timezone)),
      period: "month",
    };
  });
  const { filter, period } = settings;
  function change(filter: ReportFilter, period: Period) {
    setSettings({ filter, period });
    try {
      sessionStorage.setItem(
        `kopilka.reports.${state.mode}`,
        JSON.stringify({ filter, period }),
      );
    } catch {}
  }
  const valid =
    validRange(filter.from, filter.to) &&
    filter.to <= today(state.profile.timezone);
  const range = valid ? filter : defaultFilter(today(state.profile.timezone));
  const current = report(state, range),
    previous = report(state, {
      ...range,
      ...priorRange(period, range.from, range.to),
    });
  const diff = current.flow.expensesMinor - previous.flow.expensesMinor;
  const expenses = current.categories.filter((c) => c.kind === "expense"),
    positive = expenses.filter((c) => c.amount > 0);
  const totalPositive = positive.reduce((n, c) => n + c.amount, 0);
  const category = state.categories.find((c) => c.id === filter.category);
  const budget = state.budgets.find((b) => b.categoryId === category?.id);
  const merchants = [
    ...new Set(current.entries.map((t) => t.merchant || "Не указан")),
  ]
    .map((name) => ({
      name,
      amount: current.entries
        .filter(
          (t) =>
            (t.merchant || "Не указан") === name &&
            t.type === (category?.kind ?? "expense"),
        )
        .reduce((n, t) => n + t.amountMinor, 0),
    }))
    .sort((a, b) => b.amount - a.amount);
  const largest = current.entries
    .filter(
      (t) => t.amountMinor > 0 && t.type === (category?.kind ?? "expense"),
    )
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 5);
  const max = Math.max(
    1,
    ...current.flows.flatMap((f) => [f.income, f.expense]),
  );
  const heat = Array.from(
    {
      length: Math.min(
        366,
        differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) + 1,
      ),
    },
    (_, i) => {
      const date = format(addDays(parseISO(range.from), i), "yyyy-MM-dd");
      return { date, amount: current.byDate.get(date) ?? 0 };
    },
  );
  const maxHeat = Math.max(1, ...heat.map((d) => d.amount));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ОТ ЦИФР К ПОНИМАНИЮ</div>
          <h1>Ваши финансовые привычки</h1>
          <p>Выберите период и проследите каждую цифру до операции</p>
        </div>
      </div>
      <ReportFilters filter={filter} period={period} onChange={change} />
      {!valid ? (
        <p role="alert">
          Выберите корректный период до сегодняшней даты, не длиннее 10 лет.
        </p>
      ) : (
        <>
          <div className="analytics-stats">
            <section className="card">
              <small>Доходы за период</small>
              <strong className="big-number">
                <Money value={current.flow.incomeMinor} />
              </strong>
              <p className="hint">Возвраты покупок не считаются заработком</p>
            </section>
            <section className="card">
              <small>Чистые расходы</small>
              <strong className="big-number">
                <Money value={current.flow.expensesMinor} />
              </strong>
              <p className="hint">
                Покупки за вычетом возвратов в выбранном периоде
              </p>
            </section>
            <section className="card">
              <small>Денежный поток</small>
              <strong className="big-number">
                <Money value={current.flow.netMinor} />
              </strong>
              <p className="hint">
                Доходы минус чистые расходы · переводы исключены
              </p>
            </section>
          </div>
          <section className="card report-summary">
            <h2>
              {diff > 0
                ? "Расходы выросли"
                : diff < 0
                  ? "Расходы снизились"
                  : "Расходы не изменились"}
            </h2>
            <p>
              <Money value={Math.abs(diff)} /> относительно{" "}
              {priorRange(period, range.from, range.to).from} —{" "}
              {priorRange(period, range.from, range.to).to}
              {previous.flow.expensesMinor > 0 && !state.profile.hidden
                ? ` · ${Math.abs((diff / previous.flow.expensesMinor) * 100).toFixed(1)}%`
                : ""}
              .
            </p>
            <p className="hint">
              Календарные периоды сравниваются по одинаковым прошедшим датам;
              свой период — с предыдущим отрезком такой же длины. Отсутствие
              записей не доказывает отсутствие расходов.
            </p>
            <Link className="text-button" href={transactionsHref(range)}>
              Проверить операции за период →
            </Link>
          </section>
          {category && (
            <section className="card category-detail">
              <div className="section-title">
                <h2>
                  <Glyph value={category.icon} /> {category.name}
                </h2>
                <button
                  className="text-button"
                  onClick={() => change({ ...filter, category: "" }, period)}
                >
                  Все категории
                </button>
              </div>
              <p>
                {
                  new Set(
                    current.entries
                      .filter((t) => t.amountMinor > 0)
                      .map((t) => t.id),
                  ).size
                }{" "}
                операций · {new Set(current.entries.map((t) => t.date)).size}{" "}
                дней с операциями
              </p>
              {budget && (
                <p>
                  Бюджет текущего месяца:{" "}
                  <Money value={budgetMetrics(state, budget).spentMinor} /> из{" "}
                  <Money value={budget.limitMinor} />. Остаток:{" "}
                  <Money value={budgetMetrics(state, budget).remainingMinor} />.
                </p>
              )}
              <h3>Магазины и источники</h3>
              <div className="flow-table">
                {merchants.slice(0, 8).map((m) => (
                  <div key={m.name}>
                    <span>{m.name}</span>
                    <Money value={m.amount} />
                  </div>
                ))}
              </div>
              <h3>Крупнейшие операции</h3>
              <div className="flow-table">
                {largest.map((t, i) => (
                  <Link
                    key={`${t.id}-${i}`}
                    href={transactionsHref({
                      ...range,
                      merchant: t.merchant || "",
                    })}
                  >
                    <span>
                      {t.date} · {t.merchant || t.description || category.name}
                    </span>
                    <Money value={t.amountMinor} />
                  </Link>
                ))}
              </div>
              <Link className="text-button" href={transactionsHref(range)}>
                Все операции категории →
              </Link>
            </section>
          )}
          {!current.entries.length ? (
            <section className="card">
              <Empty
                title="В этом периоде пока нет операций"
                text="Измените фильтры или добавьте операции, чтобы увидеть картину расходов."
                action={
                  <Link href="/transactions" className="btn-primary">
                    Перейти к операциям
                  </Link>
                }
              />
            </section>
          ) : (
            <>
              <div className="planning-grid">
                <section className="card">
                  <SectionTitle title="Куда уходят деньги" />
                  {positive.length > 0 && (
                    <Donut
                      items={positive}
                      total={totalPositive}
                      caption="за выбранный период"
                    />
                  )}
                  <div className="category-breakdown">
                    {current.categories.map((c, i) => (
                      <button
                        className="report-category"
                        key={c.id}
                        onClick={() =>
                          change({ ...filter, category: c.id }, period)
                        }
                      >
                        <span
                          className="category-color"
                          style={{
                            background: chartColors[i % chartColors.length],
                          }}
                        />
                        <span>
                          <Glyph value={c.icon} size={16} /> {c.name}
                        </span>
                        <strong>
                          <Money value={c.amount} />
                        </strong>
                        <small>
                          {c.kind === "income" ? "доход" : "расход"} →
                        </small>
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    Нажмите на категорию для детализации. Круг показывает
                    положительные расходы; категории с превышающими покупки
                    возвратами остаются в списке.
                  </p>
                </section>
                <section className="card">
                  <SectionTitle title="Доходы и расходы" />
                  <p className="muted">
                    {range.from} — {range.to}
                  </p>
                  <div className="bar-chart">
                    {current.flows.slice(-12).map((f) => (
                      <div className="bar-group" key={f.month}>
                        <div className="bar-pair">
                          <div
                            style={{
                              height: `${(Math.max(0, f.income) / max) * 100}%`,
                            }}
                          />
                          <div
                            style={{
                              height: `${(Math.max(0, f.expense) / max) * 100}%`,
                            }}
                          />
                        </div>
                        <small>{f.month}</small>
                      </div>
                    ))}
                  </div>
                  <p className="hint">
                    Доходы — зелёным, расходы — бежевым. До 12 последних месяцев
                    на графике; точные суммы за весь период ниже.
                  </p>
                  <div className="flow-table">
                    {current.flows.map((f) => (
                      <div key={f.month}>
                        <span>{f.month}</span>
                        <span className="positive">
                          <Money value={f.income} />
                        </span>
                        <Money value={f.expense} />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <section className="card">
                <SectionTitle title="Ритм ваших расходов" />
                <p className="muted">
                  Первые {heat.length} дней выбранного периода. Нажмите на день
                  для детализации.
                </p>
                <div className="heatmap">
                  {heat.map((d) => (
                    <Link
                      key={d.date}
                      aria-label={`Операции за ${d.date}`}
                      href={transactionsHref({
                        ...range,
                        from: d.date,
                        to: d.date,
                      })}
                      style={{
                        background:
                          d.amount > 0
                            ? `color-mix(in srgb, #21866c ${20 + (d.amount / maxHeat) * 80}%, var(--surface-muted))`
                            : "var(--surface-muted)",
                      }}
                      title={`${d.date}: ${state.profile.hidden ? "•••" : new Intl.NumberFormat("ru-RU", { style: "currency", currency: state.profile.currency }).format(d.amount / 100)}`}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
          <section className="card chart-card">
            <SectionTitle title="Капитал в динамике" />
            <p className="hint">
              Все движения по выбранному счёту или счетам в общем балансе,
              включая переводы и корректировки. Категории и теги не ограничивают
              капитал. Последние 366 дней периода.
            </p>
            <BalanceChart
              points={historyPoints(
                {
                  ...state,
                  accounts: state.accounts.map((a) => ({
                    ...a,
                    includeInTotal: filter.account
                      ? a.id === filter.account
                      : a.includeInTotal,
                  })),
                },
                Math.min(
                  366,
                  differenceInCalendarDays(
                    parseISO(range.to),
                    parseISO(range.from),
                  ) + 1,
                ),
                range.to,
              )}
            />
          </section>
        </>
      )}
    </>
  );
}
