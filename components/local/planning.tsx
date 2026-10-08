"use client";
import { Glyph } from "./glyph";
import { WhatIf } from "./intelligence";
import { useState } from "react";
import {
  addDays,
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
} from "date-fns";
import {
  Plus,
  Check,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFinance } from "./provider";
import { useEntry } from "./workspace";
import {
  budgetMetrics,
  confirmRecurring,
  forecast,
  metrics,
  occurrences,
  purchaseImpact,
  pendingSince,
} from "@/lib/local/finance";
import { today } from "@/lib/local/model";
import { Money, Progress, SectionTitle, Field, Modal } from "./ui";
import { BalanceChart } from "./charts";
import { parseMajorToMinor } from "@/lib/finance/money";
export function Planning() {
  const { state, update } = useFinance(),
    open = useEntry(),
    asOf = today(state.profile.timezone);
  const [days, setDays] = useState(30),
    [scenario, setScenario] = useState<"base" | "careful" | "optimistic">(
      "base",
    ),
    [error, setError] = useState(""),
    [monthOffset, setMonthOffset] = useState(0),
    [edit, setEdit] = useState<string | null>(null);
  const f = forecast(state, days, asOf, scenario),
    m = metrics(state);
  const upcoming = occurrences(
    state,
    pendingSince(state, asOf),
    format(addDays(parseISO(asOf), 30), "yyyy-MM-dd"),
  );
  const month = addMonths(parseISO(asOf), monthOffset);
  const start = startOfMonth(month),
    end = endOfMonth(month);
  const scheduled = occurrences(
    state,
    format(start, "yyyy-MM-dd"),
    format(end, "yyyy-MM-dd"),
  );
  const calendar = Array.from({ length: end.getDate() }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
  async function resolve(key: string, skip = false) {
    setError("");
    try {
      await update((s) =>
        skip
          ? { ...s, resolved: [...s.resolved, key] }
          : confirmRecurring(s, key),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ЗАВТРА НАЧИНАЕТСЯ С ПЛАНА</div>
          <h1>План и прогноз</h1>
          <p>Обязательства, бюджет и пространство для манёвра</p>
        </div>
        <button className="btn-primary" onClick={() => open("recurring")}>
          <Plus size={18} />
          Регулярный платёж
        </button>
      </div>
      <div className="planning-grid">
        <section className="card chart-card">
          <div className="section-title">
            <div>
              <h2>Что будет с деньгами</h2>
              <p>
                Ликвидный баланс · уверенность: {f.confidence.toLowerCase()}
              </p>
            </div>
            <select
              aria-label="Горизонт прогноза"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} дней
                </option>
              ))}
            </select>
          </div>
          <div className="forecast-heading">
            <strong>
              <Money value={f.end} approx />
            </strong>
            <div className="segmented">
              {(
                [
                  { v: "careful", l: "Осторожный" },
                  { v: "base", l: "Базовый" },
                  { v: "optimistic", l: "Оптимистичный" },
                ] as const
              ).map((s) => (
                <button
                  className={scenario === s.v ? "active" : ""}
                  key={s.v}
                  onClick={() => setScenario(s.v)}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <BalanceChart points={f.points} forecast />
          {f.gap && (
            <div className="warning-box">
              Возможен кассовый разрыв{" "}
              {new Date(f.gap.date).toLocaleDateString("ru-RU")}. Сократите
              необязательные расходы или перенесите покупку.
            </div>
          )}
          <p className="hint">
            {f.months
              ? `Основан на ${f.months} мес. истории.`
              : "Истории пока мало: используем ваши оценки доходов и обязательных расходов."}{" "}
            Прогноз учитывает расписание и средние переменные расходы.
            Неподтверждённый доход не увеличивает текущий баланс. Целевые
            резервы учтены отдельно в «Можно потратить».
          </p>
        </section>
        <section className="card safe-explained">
          <SectionTitle title="Можно потратить" />
          <strong className="big-number">
            <Money value={m.safe} />
          </strong>
          <dl>
            <div>
              <dt>Ликвидные деньги</dt>
              <dd>
                <Money value={m.liquid} />
              </dd>
            </div>
            <div>
              <dt>Обязательства до дохода*</dt>
              <dd>
                −<Money value={m.obligations} />
              </dd>
            </div>
            <div>
              <dt>Выделено на цели</dt>
              <dd>
                −<Money value={m.reserved} />
              </dd>
            </div>
            <div>
              <dt>Минимальная подушка</dt>
              <dd>
                −<Money value={m.reserve} />
              </dd>
            </div>
          </dl>
          <p className="hint">
            *До ближайшего регулярного дохода в пределах 30 дней, иначе — за 30
            дней. Вклады и инвестиции исключены. Отрицательный результат
            показывается как 0.
          </p>
        </section>
      </div>
      <div className="planning-grid">
        <section className="card">
          <SectionTitle title="Бюджеты на месяц" />
          <div className="budget-list">
            {state.budgets.map((b) => {
              const p = budgetMetrics(state, b),
                c = state.categories.find((c) => c.id === b.categoryId);
              return (
                <div className="budget-item" key={b.id}>
                  <div className="section-title">
                    <h3>
                      <Glyph value={c?.icon ?? "other"} /> {c?.name}
                    </h3>
                    <button
                      className="text-button"
                      onClick={() => setEdit(b.id)}
                    >
                      Изменить
                    </button>
                  </div>
                  <div className="budget-amount">
                    <strong>
                      <Money value={p.spentMinor} />
                    </strong>
                    <span>
                      из <Money value={b.limitMinor} />
                    </span>
                  </div>
                  <Progress
                    value={p.usage}
                    color={
                      p.usage > 1
                        ? "var(--danger)"
                        : p.usage > 0.8
                          ? "#bd914a"
                          : undefined
                    }
                  />
                  <p className={p.willExceed ? "warning-text" : "muted"}>
                    {p.willExceed
                      ? "При текущем темпе к концу месяца: "
                      : "Прогноз на конец месяца: "}
                    <Money value={p.projectedMinor} approx />
                  </p>
                </div>
              );
            })}
            {!state.budgets.length && (
              <p className="muted">
                Задайте месячный лимит для категории и следите за темпом
                расходов.
              </p>
            )}
          </div>
          <button className="btn-secondary" onClick={() => open("budget")}>
            <Plus size={17} />
            Создать бюджет
          </button>
        </section>
        <section className="card">
          <SectionTitle title="Ожидаемые операции" />
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="expected-list">
            {upcoming.slice(0, 20).map((o) => (
              <div className="expected-item" key={o.key}>
                <div>
                  <strong>{o.template.name}</strong>
                  <small>
                    {o.date < asOf ? "Ожидает подтверждения · " : ""}
                    {new Date(o.date).toLocaleDateString("ru-RU")}
                  </small>
                </div>
                <strong
                  className={o.template.type === "income" ? "positive" : ""}
                >
                  {o.template.type === "income" ? "+" : "−"}
                  <Money
                    value={o.template.amountMinor}
                    currency={
                      state.accounts.find((a) => a.id === o.template.accountId)
                        ?.currency
                    }
                  />
                </strong>
                <div className="expected-actions">
                  <button
                    className="text-button"
                    disabled={o.date > asOf}
                    onClick={() => void resolve(o.key)}
                  >
                    <Check size={15} />
                    {o.template.type === "income" ? "Получено" : "Оплачено"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void resolve(o.key, true)}
                  >
                    <SkipForward size={15} />
                    Пропустить
                  </button>
                </div>
              </div>
            ))}
            {!upcoming.length && (
              <p className="muted">
                Добавьте аренду, подписки и регулярные доходы. Они появятся
                здесь, не меняя фактический баланс.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="card calendar-card">
        <div className="section-title">
          <h2>Финансовый календарь</h2>
          <div className="button-row">
            <button
              className="icon-button"
              aria-label="Предыдущий месяц"
              onClick={() => setMonthOffset(monthOffset - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <strong>
              {new Intl.DateTimeFormat("ru-RU", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </strong>
            <button
              className="icon-button"
              aria-label="Следующий месяц"
              onClick={() => setMonthOffset(monthOffset + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((d) => (
            <span className="weekday" key={d}>
              {d}
            </span>
          ))}
          {Array.from({ length: (start.getDay() + 6) % 7 }, (_, i) => (
            <div className="calendar-empty" key={`blank-${i}`} />
          ))}
          {calendar.map((date) => {
            const actual = state.transactions.filter(
                (t) =>
                  t.date === date &&
                  ["expense", "income"].includes(t.type) &&
                  state.accounts.find((a) => a.id === t.accountId)?.currency ===
                    state.profile.currency,
              ),
              expected = scheduled.filter(
                (o) =>
                  o.date === date &&
                  state.accounts.find((a) => a.id === o.template.accountId)
                    ?.currency === state.profile.currency,
              );
            const net = actual.reduce(
              (n, t) =>
                n + (t.type === "income" ? t.amountMinor : -t.amountMinor),
              0,
            );
            return (
              <div
                className={`calendar-day ${date === asOf ? "today" : ""}`}
                key={date}
              >
                <b>{Number(date.slice(8))}</b>
                {!!actual.length && (
                  <small
                    title="Фактический денежный поток"
                    className={net >= 0 ? "positive" : ""}
                  >
                    <Money value={net} />
                  </small>
                )}
                {expected.map((o) => (
                  <span
                    className={`calendar-event ${o.template.type}`}
                    key={o.key}
                    title={`${o.template.name} · ожидается`}
                  >
                    {o.template.name}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        <p className="hint">
          Число — фактический денежный поток. Цветные метки — ожидаемые
          операции.
        </p>
      </section>
      <div className="planning-grid">
        <PurchaseCalculator />
        <WhatIf />
        <section className="card">
          <SectionTitle title="Регулярные платежи" />
          {state.recurring.map((r) => (
            <div className="subscription-row" key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <small>
                  {r.day} числа ·{" "}
                  <Money
                    value={r.amountMinor * 12}
                    currency={
                      state.accounts.find((a) => a.id === r.accountId)?.currency
                    }
                  />{" "}
                  в год
                </small>
              </div>
              <button
                className="btn-secondary compact"
                onClick={() =>
                  void update((s) => ({
                    ...s,
                    recurring: s.recurring.map((x) =>
                      x.id === r.id ? { ...x, active: !x.active } : x,
                    ),
                  }))
                }
              >
                {r.active ? "Приостановить" : "Возобновить"}
              </button>
            </div>
          ))}
          {!state.recurring.length && (
            <p className="muted">Подписки и регулярные платежи будут здесь.</p>
          )}
        </section>
      </div>
      {edit && (
        <Modal title="Изменить месячный бюджет" onClose={() => setEdit(null)}>
          <form
            className="entry-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const limit = parseMajorToMinor(
                  String(new FormData(e.currentTarget).get("limit")),
                );
                if (limit <= 0)
                  throw new Error("Лимит должен быть больше нуля");
                await update((s) => ({
                  ...s,
                  budgets: s.budgets.map((b) =>
                    b.id === edit ? { ...b, limitMinor: limit } : b,
                  ),
                }));
                setEdit(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Не удалось сохранить",
                );
              }
            }}
          >
            <Field label="Новый лимит">
              <input
                name="limit"
                inputMode="decimal"
                defaultValue={
                  state.budgets.find((b) => b.id === edit)!.limitMinor / 100
                }
                required
              />
            </Field>
            {error && <p role="alert">{error}</p>}
            <button className="btn-primary">Сохранить</button>
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Удалить бюджет? История расходов сохранится.",
                  )
                )
                  return;
                try {
                  await update((s) => ({
                    ...s,
                    budgets: s.budgets.filter((b) => b.id !== edit),
                  }));
                  setEdit(null);
                } catch {
                  setError("Не удалось сохранить изменения");
                }
              }}
            >
              Удалить бюджет
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function PurchaseCalculator() {
  const { state } = useFinance();
  const [result, setResult] = useState<ReturnType<
      typeof purchaseImpact
    > | null>(null),
    [error, setError] = useState("");
  return (
    <section className="card">
      <SectionTitle title="Могу ли я себе это позволить?" />
      <p className="muted">
        Проверьте покупку с учётом резерва и будущих платежей.
      </p>
      <form
        className="entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const fd = new FormData(e.currentTarget),
              cost = parseMajorToMinor(String(fd.get("cost")));
            if (cost <= 0) throw new Error("Введите положительную стоимость");
            setResult(purchaseImpact(state, cost, String(fd.get("date"))));
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Проверьте данные");
          }
        }}
      >
        <div className="form-grid">
          <Field label="Стоимость покупки">
            <input
              name="cost"
              inputMode="decimal"
              required
              placeholder="120 000"
            />
          </Field>
          <Field label="Дата покупки">
            <input
              name="date"
              type="date"
              min={today(state.profile.timezone)}
              max={format(
                addDays(parseISO(today(state.profile.timezone)), 365),
                "yyyy-MM-dd",
              )}
              defaultValue={today(state.profile.timezone)}
              required
            />
          </Field>
        </div>
        <button className="btn-secondary">Рассчитать влияние</button>
        {error && <p role="alert">{error}</p>}
        {result && (
          <div className={result.safe ? "success-box" : "warning-box"}>
            <strong>{result.status}</strong>
            <p>
              После покупки: <Money value={result.remaining} approx />. Покрытие
              обязательных расходов за вычетом целей:{" "}
              {result.reserveMonths.toFixed(1)} мес.
            </p>
            <p>
              Минимальный остаток в следующие 30 дней:{" "}
              <Money value={result.minimum} approx />.
            </p>
            {result.gapDate && (
              <p>
                Возможный кассовый разрыв:{" "}
                {new Intl.DateTimeFormat("ru-RU").format(
                  new Date(result.gapDate),
                )}
                .
              </p>
            )}
            {result.reserveShortfall > 0 && (
              <p>
                Чтобы сохранить резерв и деньги на цели, в этом сценарии не
                хватает <Money value={result.reserveShortfall} approx />.
                Уменьшите стоимость или перенесите покупку.
              </p>
            )}
            <small>
              Расчёт по базовому сценарию. Будущие доходы не гарантированы.
            </small>
          </div>
        )}
      </form>
    </section>
  );
}
