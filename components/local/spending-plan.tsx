"use client";
import { BrandDate } from "./branded-controls";
import { useState } from "react";
import { useFinance } from "./provider";
import { spendingPlan } from "@/lib/local/spending";
import { dateSchema, today } from "@/lib/local/model";
import { Money } from "./ui";
export function SpendingPlan() {
  const { state } = useFinance(),
    [until, setUntil] = useState("");
  const asOf = today(state.profile.timezone),
    base = spendingPlan(state);
  const valid =
    !until ||
    (dateSchema.safeParse(until).success &&
      until >= asOf &&
      until <= base.maxDate);
  const m = spendingPlan(state, valid ? until : undefined);
  return (
    <section className="card spending-plan" id="safe-to-spend">
      <div className="eyebrow">ПОНЯТНЫЙ ПЛАН ДО {m.end}</div>
      <h2>Сколько действительно доступно</h2>
      <label>
        Горизонт расчёта
        <BrandDate
          aria-label="Горизонт расчёта"
          min={asOf}
          max={base.maxDate}
          value={until || base.end}
          onChange={(e) => setUntil(e.target.value)}
        />
      </label>
      <button className="text-button" onClick={() => setUntil("")}>
        До ближайшего дохода, иначе на 30 дней
      </button>
      {!valid ? (
        <p role="alert">Выберите дату в ближайшие 365 дней</p>
      ) : (
        <>
          <dl className="money-breakdown">
            {[
              ["Ликвидные деньги сейчас", m.liquid],
              ["Обязательные платежи", -m.obligations],
              ["Резерв финансовых целей", -m.reserved],
              ["Минимальная подушка", -m.reserve],
              ["Доступно после резервов", m.safe],
              ["Ориентир повседневных расходов", -m.ordinary],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <Money value={Number(value)} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="big-number">
            <Money value={m.free} />
          </p>
          <p>Остаётся на дополнительные покупки после обычных расходов.</p>
          <p className="hint">
            Обычные расходы — оценка по истории или осторожному стартовому
            предположению; включает регулярные необязательные платежи и
            обязательные расходы без шаблона. Это ориентир, а не гарантия.
          </p>
          <details>
            <summary>Какие платежи учтены ({m.payments.length})</summary>
            <div className="flow-table">
              {m.payments.map((o) => (
                <div key={o.key}>
                  <span>
                    {o.date} · {o.template.name}
                    {o.template.mandatory ? " · обязательный" : ""}
                  </span>
                  <Money value={o.template.amountMinor} />
                </div>
              ))}
            </div>
            {!m.payments.length && (
              <p>Нет регулярных платежей в этом периоде. Добавьте их в план.</p>
            )}
          </details>
          <details>
            <summary>Прогноз с будущими доходами</summary>
            <p>
              Ожидается <Money value={m.expectedIncome} />. Расчётный остаток до
              резервирования целей и подушки:{" "}
              <Money value={m.projected} approx />.
            </p>
            <p className="hint">
              Будущие поступления не включены в доступные деньги сейчас.
              Результат зависит от подтверждения доходов.
            </p>
          </details>
          <p className="hint">
            Доступная сумма изменяется при новых операциях, переносе горизонта,
            изменении платежей, целей и размера подушки. Депозиты и инвестиции
            исключены из ликвидных денег.
          </p>
        </>
      )}
    </section>
  );
}
