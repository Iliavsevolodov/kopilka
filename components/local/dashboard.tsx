"use client";
import { Glyph } from "./glyph";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Plus,
  ArrowLeftRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { useFinance } from "./provider";
import { Money, Progress, SectionTitle, Empty } from "./ui";
import { BalanceChart } from "./charts";
import {
  metrics,
  historyPoints,
  forecast,
  insights,
  occurrences,
} from "@/lib/local/finance";
import { today, type Transaction } from "@/lib/local/model";
import type { FormKind } from "./forms";
export function TransactionRows({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const { state } = useFinance();
  return (
    <div className="transaction-list">
      {transactions.map((t) => {
        const c = state.categories.find((c) => c.id === t.categoryId),
          a = state.accounts.find((a) => a.id === t.accountId);
        return (
          <div className="transaction-row" key={t.id}>
            <span
              className={`transaction-icon ${t.type === "income" ? "income-icon" : ""}`}
            >
              {t.type === "transfer" ? (
                <ArrowLeftRight size={18} />
              ) : (
                <Glyph value={c?.icon ?? "±"} />
              )}
            </span>
            <div className="transaction-main">
              <strong>
                {t.description ||
                  c?.name ||
                  (t.type === "transfer"
                    ? "Перевод между счетами"
                    : "Корректировка")}
              </strong>
              <small>
                {c?.name ?? "Между своими счетами"} · {a?.name}
                {t.type === "transfer"
                  ? ` → ${state.accounts.find((a) => a.id === t.destinationAccountId)?.name}`
                  : ""}
              </small>
            </div>
            <div className="transaction-amount">
              <strong className={t.type === "income" ? "positive" : ""}>
                {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                <Money value={t.amountMinor} currency={a?.currency} />
              </strong>
              <small>
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "short",
                }).format(new Date(t.date))}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function Dashboard({ open }: { open: (kind: FormKind) => void }) {
  const { state, update } = useFinance();
  const m = metrics(state);
  const [days, setDays] = useState(30);
  const f = forecast(state, 30);
  const notes = insights(state);
  const asOf = today(state.profile.timezone);
  const upcoming = occurrences(
    state,
    asOf,
    format(addDays(parseISO(asOf), 14), "yyyy-MM-dd"),
  ).slice(0, 4);
  const goals = state.goals.filter((g) => !g.archived);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: state.profile.timezone,
    }).format(new Date()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ВАШ ФИНАНСОВЫЙ ОБЗОР</div>
          <h1>
            {hour < 6
              ? "Доброй ночи"
              : hour < 12
                ? "Доброе утро"
                : hour < 18
                  ? "Добрый день"
                  : "Добрый вечер"}
            , {state.profile.name} <span className="wave">✦</span>
          </h1>
          <p>
            {new Intl.DateTimeFormat("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: state.profile.timezone,
            }).format(new Date())}{" "}
            <span className="heading-dot">·</span> Сегодня — хороший день для
            ваших планов
          </p>
        </div>
        <button
          className="btn-primary desktop-add"
          onClick={() => open("expense")}
        >
          <Plus size={18} />
          Добавить операцию
        </button>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="balance-grid">
            <section className="balance-card">
              <div className="balance-label">
                Общий баланс{" "}
                <button
                  className="icon-button"
                  aria-label={
                    state.profile.hidden ? "Показать суммы" : "Скрыть суммы"
                  }
                  onClick={() =>
                    void update((s) => ({
                      ...s,
                      profile: { ...s.profile, hidden: !s.profile.hidden },
                    }))
                  }
                >
                  {state.profile.hidden ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
              <div className="hero-amount">
                <Money value={m.total} />
              </div>
              <span className="balance-change">
                <TrendingUp size={14} />
                {m.flow.netMinor >= 0 ? "+" : ""}
                <Money value={m.flow.netMinor} />{" "}
                <span>денежный поток за месяц</span>
              </span>
              <div className="balance-breakdown">
                {[
                  {
                    label: "На счетах",
                    types: ["card", "wallet", "other", "investment", "deposit"],
                  },
                  { label: "Накопления", types: ["savings"] },
                  { label: "Наличные", types: ["cash"] },
                ].map((item) => (
                  <div key={item.label}>
                    <small>{item.label}</small>
                    <strong>
                      <Money
                        value={m.accounts
                          .filter(
                            (a) =>
                              a.includeInTotal &&
                              a.currency === state.profile.currency &&
                              item.types.includes(a.type),
                          )
                          .reduce((n, a) => n + a.balanceMinor, 0)}
                      />
                    </strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="safe-card">
              <span className="safe-icon">
                <ShieldCheck size={22} />
              </span>
              <div className="safe-title">Можно потратить</div>
              <strong className="safe-amount">
                <Money value={m.safe} />
              </strong>
              <p>
                После обязательных платежей,
                <br />
                резервов и денег на цели
              </p>
              <Link href="/plan">
                Как это рассчитано <ArrowUpRight size={15} />
              </Link>
            </section>
          </div>
          <div className="flow-grid">
            <div className="card flow-card">
              <span className="flow-icon green">
                <ArrowDownLeft size={20} />
              </span>
              <div>
                <small>Доходы за месяц</small>
                <strong>
                  <Money value={m.flow.incomeMinor} />
                </strong>
              </div>
            </div>
            <div className="card flow-card">
              <span className="flow-icon peach">
                <ArrowUpRight size={20} />
              </span>
              <div>
                <small>Расходы за месяц</small>
                <strong>
                  <Money value={m.flow.expensesMinor} />
                </strong>
              </div>
            </div>
            <div className="card flow-card">
              <span className="flow-icon lavender">
                <TrendingUp size={20} />
              </span>
              <div>
                <small>Доля накоплений</small>
                <strong>
                  {state.profile.hidden
                    ? "•••"
                    : m.flow.incomeMinor
                      ? `${m.rate.toFixed(1)}%`
                      : "—"}
                </strong>
              </div>
            </div>
          </div>
          <section className="card chart-card">
            <div className="section-title">
              <div>
                <h2>Деньги в движении</h2>
                <p>Динамика вашего общего баланса</p>
              </div>
              <div className="segmented">
                {[
                  { d: 7, l: "7 дн." },
                  { d: 30, l: "Месяц" },
                  { d: 90, l: "3 мес." },
                  { d: 365, l: "Год" },
                ].map((i) => (
                  <button
                    key={i.d}
                    className={days === i.d ? "active" : ""}
                    onClick={() => setDays(i.d)}
                  >
                    {i.l}
                  </button>
                ))}
              </div>
            </div>
            <BalanceChart points={historyPoints(state, days)} />
            <div className="chart-footer">
              <span>
                <i />
                Фактический баланс
              </span>
              <Link href="/analytics">
                Открыть аналитику <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>
          <div className="quick-actions">
            <button onClick={() => open("expense")}>
              <span>
                <ArrowUpRight />
              </span>
              Расход
            </button>
            <button onClick={() => open("income")}>
              <span>
                <ArrowDownLeft />
              </span>
              Доход
            </button>
            <button onClick={() => open("transfer")}>
              <span>
                <ArrowLeftRight />
              </span>
              Перевод
            </button>
            <button onClick={() => open("goal")}>
              <span>
                <Plus />
              </span>
              Новая цель
            </button>
          </div>
          <section className="card transactions-card">
            <SectionTitle
              title="Последние операции"
              href="/transactions"
              label="Вся история"
            />
            {state.transactions.length ? (
              <TransactionRows
                transactions={[...state.transactions]
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) ||
                      b.createdAt.localeCompare(a.createdAt),
                  )
                  .slice(0, 5)}
              />
            ) : (
              <Empty
                title="История начинается с первой записи"
                text="Добавьте доход или расход, чтобы увидеть движение ваших денег."
                action={
                  <button
                    className="btn-primary"
                    onClick={() => open("expense")}
                  >
                    Добавить расход
                  </button>
                }
              />
            )}
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="card insight-card">
            <div className="section-title">
              <h2>
                <Sparkles size={18} />
                Полезно знать
              </h2>
              <span className="tiny-tag">ИНСАЙТЫ</span>
            </div>
            {notes.slice(0, 2).map((n, i) => (
              <Link
                className={`insight insight-${n.kind}`}
                href={n.href}
                key={i}
              >
                <span className="insight-number">0{i + 1}</span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.description}</p>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))}
          </section>
          <section className="forecast-card">
            <span className="eyebrow">ЗАГЛЯНЕМ ВПЕРЁД</span>
            <h2>Через 30 дней</h2>
            <strong>
              <Money value={f.end} approx />
            </strong>
            <p>Базовый прогноз доступных денег</p>
            <div className="forecast-confidence">
              <span className="status-dot" />
              {f.confidence} уверенность · {f.months} мес. истории
            </div>
            <Link href="/plan">
              Посмотреть прогноз <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="card goals-card">
            <SectionTitle title="Ближе к мечте" href="/goals" />
            {goals.length ? (
              goals.slice(0, 2).map((g) => (
                <Link href="/goals" className="goal-mini" key={g.id}>
                  <div className="goal-mini-title">
                    <span>
                      <Glyph value={g.icon} />
                    </span>
                    <strong>{g.name}</strong>
                    <small>
                      {Math.round((g.savedMinor / g.targetMinor) * 100)}%
                    </small>
                  </div>
                  <Progress value={g.savedMinor / g.targetMinor} />
                  <div className="goal-mini-values">
                    <Money value={g.savedMinor} />
                    <span>
                      из <Money value={g.targetMinor} />
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="muted">
                Добавьте цель, ради которой хочется откладывать.
              </p>
            )}
            <button className="text-button" onClick={() => open("goal")}>
              <Plus size={15} />
              Добавить цель
            </button>
          </section>
          <section className="card upcoming-card">
            <SectionTitle title="Ближайшие платежи" href="/plan" />
            {upcoming.length ? (
              upcoming.map((o) => (
                <div className="upcoming-row" key={o.key}>
                  <span className="date-tile">
                    {o.date.slice(8)}
                    <small>
                      {new Intl.DateTimeFormat("ru-RU", {
                        month: "short",
                      }).format(new Date(o.date))}
                    </small>
                  </span>
                  <div>
                    <strong>{o.template.name}</strong>
                    <small>
                      Ожидается ·{" "}
                      {o.template.type === "income" ? "доход" : "расход"}
                    </small>
                  </div>
                  <b className={o.template.type === "income" ? "positive" : ""}>
                    {o.template.type === "income" ? "+" : "−"}
                    <Money
                      value={o.template.amountMinor}
                      currency={
                        state.accounts.find(
                          (a) => a.id === o.template.accountId,
                        )?.currency
                      }
                    />
                  </b>
                </div>
              ))
            ) : (
              <p className="muted">
                На ближайшие 14 дней платежей нет. Добавьте регулярные расходы в
                план.
              </p>
            )}
          </section>
        </aside>
      </div>
      <footer className="page-footer">
        <span>
          <ShieldCheck size={13} />
          Ваши финансы — под вашим контролем
        </span>
        <span>KOPILKA · Пространство для будущего</span>
      </footer>
    </>
  );
}
