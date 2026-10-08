"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { metrics, forecast, goalMonthly } from "@/lib/local/finance";
import { today } from "@/lib/local/model";
import { useFinance } from "./provider";
import { behaviorProfile, simulateScenario } from "@/lib/local/intelligence";
import { Money, Field, Progress, SectionTitle } from "./ui";
import { parseMajorToMinor } from "@/lib/finance/money";

export function FinancialHealth() {
  const { state } = useFinance();
  const p = behaviorProfile(state);
  return (
    <section className="card financial-health">
      <div className="section-title">
        <h2>
          <ShieldCheck size={20} /> Финансовая форма
        </h2>
        <span className="tiny-tag">БЕТА</span>
      </div>
      <div className="health-heading">
        <strong>
          {state.profile.hidden ? "••" : (p.score ?? "—")}
          <small> / 100</small>
        </strong>
        <p>
          {p.score === null
            ? "Собираем вашу финансовую историю"
            : p.score >= 75
              ? "Хорошая основа для ваших планов"
              : p.score >= 45
                ? "Есть возможности укрепить финансы"
                : "Начните с резерва и контроля расходов"}
        </p>
      </div>
      {p.score === null && (
        <p className="hint">
          Для оценки нужен хотя бы один прошлый месяц истории и полученный доход
          в текущем месяце.
        </p>
      )}
      <div className="health-components">
        {p.components.map((c) => (
          <div key={c.name}>
            <div>
              <span>{c.name}</span>
              <b>{state.profile.hidden ? "••" : (c.value ?? "—")}</b>
            </div>
            <Progress value={state.profile.hidden ? 0 : (c.value ?? 0) / 100} />
          </div>
        ))}
      </div>
      <details className="methodology">
        <summary>Как считается показатель</summary>
        <p>
          Внутренний ориентир, а не кредитный рейтинг. Среднее доступных
          показателей с одинаковым весом. Оценка меняется после внесения
          операций.
        </p>
        {p.components.map((c) => (
          <p key={c.name}>
            <b>{c.name}:</b> {c.explanation}
          </p>
        ))}
      </details>
    </section>
  );
}
export function PeriodComparison() {
  const { state } = useFinance();
  const p = behaviorProfile(state);
  return (
    <section className="card period-comparison">
      <SectionTitle title="Что изменилось в расходах" />
      <p className="muted">
        С начала месяца и за те же дни прошлого месяца, по{" "}
        {Number(p.previousEnd.slice(8))}-е число.
      </p>
      <div className="comparison-totals">
        <div>
          <small>Сейчас</small>
          <strong>
            <Money value={p.currentMinor} />
          </strong>
        </div>
        <div>
          <small>Прошлый месяц</small>
          <strong>
            <Money value={p.previousMinor} />
          </strong>
        </div>
      </div>
      <p className="comparison-conclusion">
        {state.profile.hidden
          ? "Суммы скрыты"
          : p.change === null
            ? "В прошлом периоде нет расходов для сравнения"
            : `Расходы ${p.change > 0 ? "выросли" : "снизились"} на ${Math.abs(p.change).toFixed(1)}%`}
      </p>
      {p.categories.slice(0, 5).map((c) => (
        <Link
          className="comparison-row"
          href={`/transactions?category=${encodeURIComponent(c.id)}`}
          key={c.id}
        >
          <div>
            <strong>{c.name}</strong>
            <small>
              {c.previousMinor
                ? "Изменение к прошлому периоду"
                : "Не было расходов в прошлом периоде"}
            </small>
          </div>
          <span>
            {c.difference > 0 ? "+" : ""}
            <Money value={c.difference} />
          </span>
          <ArrowUpRight size={16} />
        </Link>
      ))}
      <div className="impulse-summary">
        <strong>Импульсивные покупки</strong>
        <span>
          {state.profile.hidden ? "••" : p.impulseCount} операций ·{" "}
          <Money value={p.impulseMinor} />
        </span>
        <p>Учитываются только расходы, которые вы отметили как импульсивные.</p>
      </div>
    </section>
  );
}
export function WhatIf() {
  const { state } = useFinance();
  const [income, setIncome] = useState("0"),
    [purchase, setPurchase] = useState("0"),
    [reduction, setReduction] = useState(10);
  let result: ReturnType<typeof simulateScenario> | null = null,
    error = "";
  try {
    result = simulateScenario(state, {
      incomeDeltaMinor: parseMajorToMinor(income || "0"),
      purchaseMinor: parseMajorToMinor(purchase || "0"),
      variableReductionPercent: reduction,
    });
  } catch {
    error =
      "Введите корректные суммы. Разовая покупка не может быть отрицательной.";
  }
  return (
    <section className="card what-if">
      <SectionTitle title="Что, если изменить план?" />
      <p className="muted">
        Исследуйте сценарий на год. Ваши операции и цели не изменятся.
      </p>
      <div className="entry-form">
        <div className="form-grid">
          <Field label="Изменение дохода в месяц">
            <input
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="Например, 20 000"
            />
          </Field>
          <Field label="Разовая покупка сейчас">
            <input
              inputMode="decimal"
              value={purchase}
              onChange={(e) => setPurchase(e.target.value)}
            />
          </Field>
        </div>
        <Field label={`Снизить переменные расходы на ${reduction}%`}>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={reduction}
            onChange={(e) => setReduction(Number(e.target.value))}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="warning-box">
          {error}
        </p>
      )}
      {result && (
        <div className="scenario-result" aria-live="polite">
          <span>
            <SlidersHorizontal size={18} /> Денежный остаток через год
          </span>
          <strong>
            <Money value={result.end} approx />
          </strong>
          <p>
            Базовый прогноз: <Money value={result.base} approx />
          </p>
          <p>
            Разница: {result.delta > 0 ? "+" : ""}
            <Money value={result.delta} approx />
          </p>
          {result.gap && (
            <p className="warning-box">
              Возможен кассовый разрыв{" "}
              {new Intl.DateTimeFormat("ru-RU").format(
                new Date(result.gap.date),
              )}
              . Проверьте ближайшие платежи.
            </p>
          )}
        </div>
      )}
      <details className="methodology">
        <summary>Допущения сценария</summary>
        <p>
          Изменение дохода применяется каждые 30 дней, начиная с 30-го дня.
          Сокращаются только оценочные переменные расходы. Обязательные платежи
          сохраняются. Покупка вычитается сразу. Это модель денежных остатков,
          не гарантия результата и не оценка имущества.
        </p>
      </details>
    </section>
  );
}

export function DecisionAssistant() {
  const { state } = useFinance();
  const [question, setQuestion] = useState("spend");
  const m = metrics(state),
    p = behaviorProfile(state),
    f = forecast(state, 30);
  const questions = [
    { id: "spend", text: "Сколько можно потратить?" },
    { id: "growth", text: "Где выросли расходы?" },
    { id: "future", text: "Что будет через месяц?" },
    { id: "goal", text: "Как приблизиться к цели?" },
  ];
  const goal = state.goals
    .filter((g) => !g.archived && g.savedMinor < g.targetMinor)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">РЕШЕНИЯ НА ОСНОВЕ ВАШИХ ДАННЫХ</div>
          <h1>Финансовый помощник</h1>
          <p>Точные расчёты и понятные объяснения, прямо на устройстве.</p>
        </div>
      </div>
      <div
        className="advisor-questions"
        role="group"
        aria-label="Вопросы помощнику"
      >
        {questions.map((q) => (
          <button
            key={q.id}
            aria-pressed={q.id === question}
            className={q.id === question ? "selected" : ""}
            onClick={() => setQuestion(q.id)}
          >
            {q.text}
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      <section className="card advisor-answer" aria-live="polite">
        <span className="eyebrow">
          {questions.find((q) => q.id === question)?.text}
        </span>
        {question === "spend" && (
          <>
            <strong className="big-number">
              <Money value={m.safe} />
            </strong>
            <p>
              Из ликвидного остатка <Money value={m.liquid} /> вычтены
              обязательства до следующего ожидаемого дохода (
              <Money value={m.obligations} />
              ), деньги на цели (<Money value={m.reserved} />) и минимальная
              подушка (<Money value={m.reserve} />
              ).
            </p>
            <p className="hint">
              Обычные будущие расходы могут уменьшить эту сумму. Перед крупной
              покупкой проверьте её влияние на прогноз.
            </p>
            <Link href="/plan" className="btn-primary">
              Проверить покупку
            </Link>
          </>
        )}
        {question === "growth" && (
          <>
            <h2>Сравним одинаковые дни двух месяцев</h2>
            {p.categories.filter((c) => c.difference > 0).length ? (
              p.categories
                .filter((c) => c.difference > 0)
                .slice(0, 3)
                .map((c) => (
                  <div className="comparison-row" key={c.id}>
                    <strong>{c.name}</strong>
                    <span>
                      +<Money value={c.difference} />
                    </span>
                  </div>
                ))
            ) : (
              <p>
                По внесённым операциям роста расходов в категориях нет. Если
                история неполная, вывод может измениться.
              </p>
            )}
            <p className="hint">
              Начните с самой выросшей категории и проверьте, какие покупки были
              разовыми.
            </p>
            <Link href="/analytics" className="btn-primary">
              Разобрать расходы
            </Link>
          </>
        )}
        {question === "future" && (
          <>
            <strong className="big-number">
              <Money value={f.end} approx />
            </strong>
            <p>
              Ожидаемый ликвидный остаток через 30 дней. Прогноз учитывает
              расписание платежей и оценку повседневных трат.
            </p>
            <p className="hint">
              {f.confidence} уверенность · {f.months} мес. истории.{" "}
              {f.gap
                ? `Возможен кассовый разрыв ${new Intl.DateTimeFormat("ru-RU").format(new Date(f.gap.date))}.`
                : "Базовый сценарий не показывает отрицательного остатка в ближайшие 30 дней."}{" "}
              Доходы ещё не получены и не гарантированы.
            </p>
            <Link href="/plan" className="btn-primary">
              Изменить сценарий
            </Link>
          </>
        )}
        {question === "goal" &&
          (goal ? (
            <>
              <h2>{goal.name}</h2>
              <strong className="big-number">
                <Money
                  value={goalMonthly(
                    goal.targetMinor,
                    goal.savedMinor,
                    goal.date,
                    today(state.profile.timezone),
                  )}
                />
                <small> / месяц</small>
              </strong>
              <p>
                Расчётный взнос до{" "}
                {new Intl.DateTimeFormat("ru-RU").format(new Date(goal.date))}.
                Осталось накопить{" "}
                <Money value={goal.targetMinor - goal.savedMinor} />.
              </p>
              <p className="hint">
                Это необходимый темп, а не рекомендация резервировать такую
                сумму без проверки обязательных расходов.
              </p>
              <Link href="/goals" className="btn-primary">
                Открыть цели
              </Link>
            </>
          ) : (
            <>
              <h2>Дайте своим накоплениям цель</h2>
              <p>
                Укажите желаемую сумму и срок — рассчитаем необходимый
                ежемесячный взнос.
              </p>
              <Link href="/goals" className="btn-primary">
                Создать цель
              </Link>
            </>
          ))}
      </section>
      <p className="hint">
        Помощник использует фиксированные правила и финансовые формулы. Внешняя
        языковая модель не подключена, данные никуда не отправляются.
      </p>
    </>
  );
}
