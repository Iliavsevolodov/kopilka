"use client";
import Link from "next/link";
import { useFinance } from "./provider";
import { metrics, historyPoints } from "@/lib/local/finance";
import { Money, SectionTitle, Empty } from "./ui";
import { BalanceChart, Donut, chartColors } from "./charts";
import { today } from "@/lib/local/model";
import { addDays, format, parseISO, subMonths } from "date-fns";
export function Analytics() {
  const { state } = useFinance();
  const m = metrics(state);
  const asOf = today(state.profile.timezone);
  const months = Array.from({ length: 6 }, (_, i) =>
    format(subMonths(parseISO(asOf), 5 - i), "yyyy-MM"),
  );
  const flows = months.map((month) => ({
    month,
    income: m.currencyTx
      .filter((t) => t.date.startsWith(month) && t.type === "income")
      .reduce((n, t) => n + t.amountMinor, 0),
    expense: m.currencyTx
      .filter((t) => t.date.startsWith(month) && t.type === "expense")
      .reduce((n, t) => n + t.amountMinor, 0),
  }));
  const maximum = Math.max(1, ...flows.flatMap((f) => [f.income, f.expense]));
  const prev = flows[4].expense;
  const change = prev ? ((m.flow.expensesMinor - prev) / prev) * 100 : null;
  const heat = Array.from({ length: 91 }, (_, i) => {
    const date = format(addDays(parseISO(asOf), i - 90), "yyyy-MM-dd");
    return {
      date,
      amount: m.currencyTx
        .filter((t) => t.date === date && t.type === "expense")
        .reduce((n, t) => n + t.amountMinor, 0),
    };
  });
  const maxHeat = Math.max(1, ...heat.map((d) => d.amount));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ОТ ЦИФР К ПОНИМАНИЮ</div>
          <h1>Ваши финансовые привычки</h1>
          <p>
            Фактические операции в {state.profile.currency} · переводы исключены
          </p>
        </div>
        <span className="period-label">
          {new Intl.DateTimeFormat("ru-RU", {
            month: "long",
            year: "numeric",
          }).format(new Date())}
        </span>
      </div>
      {!state.transactions.length ? (
        <section className="card">
          <Empty
            title="Ваша история ещё впереди"
            text="Добавьте операции, чтобы увидеть структуру расходов, динамику и привычки."
            action={
              <Link className="btn-primary" href="/transactions">
                Перейти к операциям
              </Link>
            }
          />
        </section>
      ) : (
        <>
          <div className="analytics-stats">
            <section className="card">
              <small>Расходы за текущий месяц</small>
              <strong className="big-number">
                <Money value={m.flow.expensesMinor} />
              </strong>
              <p className="muted">
                {change === null
                  ? "Нет данных для сравнения"
                  : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% к полному предыдущему месяцу`}
              </p>
            </section>
            <section className="card">
              <small>Чистый денежный поток</small>
              <strong className="big-number">
                <Money value={m.flow.netMinor} />
              </strong>
              <p className="muted">Доходы минус расходы</p>
            </section>
            <section className="card">
              <small>Финансовая подушка</small>
              <strong className="big-number">
                {m.mandatory ? `${m.cushion.toFixed(1)} мес.` : "—"}
              </strong>
              <p className="muted">
                Накопительные счета / обязательные расходы
              </p>
            </section>
          </div>
          <div className="planning-grid">
            <section className="card">
              <SectionTitle title="Куда уходят деньги" />
              {m.categories.length ? (
                <>
                  <Donut items={m.categories} total={m.flow.expensesMinor} />
                  <div className="category-breakdown">
                    {m.categories.map((c, i) => (
                      <Link key={c.id} href="/transactions">
                        <span
                          className="category-color"
                          style={{
                            background: chartColors[i % chartColors.length],
                          }}
                        />
                        <span>{c.name}</span>
                        <strong>
                          <Money value={c.amount} />
                        </strong>
                        <small>
                          {Math.round((c.amount / m.flow.expensesMinor) * 100)}%
                        </small>
                      </Link>
                    ))}
                  </div>
                  <p className="hint">
                    Больше всего в этом месяце:{" "}
                    {m.categories[0]?.name.toLowerCase()}.
                  </p>
                </>
              ) : (
                <p className="muted">В текущем месяце пока нет расходов.</p>
              )}
            </section>
            <section className="card">
              <SectionTitle title="Доходы и расходы" />
              <p className="muted">
                Последние 6 месяцев · текущий месяц неполный
              </p>
              <div className="bar-chart">
                {flows.map((f) => (
                  <div className="bar-group" key={f.month}>
                    <div className="bar-pair">
                      <div style={{ height: `${(f.income / maximum) * 100}%` }}>
                        <span>
                          {state.profile.hidden
                            ? "•••"
                            : Math.round(f.income / 100000) + " тыс."}
                        </span>
                      </div>
                      <div
                        style={{ height: `${(f.expense / maximum) * 100}%` }}
                      >
                        <span>
                          {state.profile.hidden
                            ? "•••"
                            : Math.round(f.expense / 100000) + " тыс."}
                        </span>
                      </div>
                    </div>
                    <small>
                      {new Intl.DateTimeFormat("ru-RU", {
                        month: "short",
                      }).format(new Date(f.month + "-01"))}
                    </small>
                  </div>
                ))}
              </div>
              <div className="chart-footer">
                <span>
                  <i />
                  Доходы
                </span>
                <span>
                  <i style={{ background: "#cbbca0" }} />
                  Расходы
                </span>
              </div>
              <p className="hint">Точный итог за каждый месяц</p>
              <div className="flow-table">
                {flows.map((f) => (
                  <div key={f.month}>
                    <span>{f.month}</span>
                    <span className="positive">
                      <Money value={f.income} />
                    </span>
                    <span>
                      <Money value={f.expense} />
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="card chart-card">
            <SectionTitle title="Капитал в динамике" />
            <BalanceChart points={historyPoints(state, 180)} />
          </section>
          <section className="card">
            <SectionTitle title="Ритм ваших расходов" />
            <p className="muted">
              Последние 13 недель. Чем насыщеннее клетка, тем больше расходов за
              день.
            </p>
            <div className="heatmap">
              {heat.map((d) => (
                <div
                  key={d.date}
                  style={{
                    background: d.amount
                      ? `color-mix(in srgb, #21866c ${20 + (d.amount / maxHeat) * 80}%, var(--surface-muted))`
                      : "var(--surface-muted)",
                  }}
                  title={`${d.date}: ${state.profile.hidden ? "•••" : (d.amount / 100).toLocaleString("ru-RU")} ${state.profile.currency}`}
                />
              ))}
            </div>
            <div className="chart-footer">
              <span>{heat[0].date}</span>
              <span>{asOf}</span>
            </div>
          </section>
        </>
      )}
    </>
  );
}
