"use client";
import { BrandSelect, BrandDate } from "./branded-controls";
import { useFinance } from "./provider";
import { today } from "@/lib/local/model";
import {
  periodRange,
  type Period,
  type ReportFilter,
} from "@/lib/local/reports";
export function ReportFilters({
  filter,
  period,
  onChange,
}: {
  filter: ReportFilter;
  period: Period;
  onChange: (f: ReportFilter, p: Period) => void;
}) {
  const { state } = useFinance();
  const set = (key: keyof ReportFilter, value: string) =>
    onChange({ ...filter, [key]: value }, period);
  return (
    <section className="card report-filters" aria-label="Фильтры аналитики">
      <div className="period-tabs">
        {(
          [
            ["week", "Неделя"],
            ["month", "Месяц"],
            ["quarter", "Квартал"],
            ["year", "Год"],
            ["custom", "Свой период"],
          ] as const
        ).map(([p, label]) => (
          <button
            key={p}
            className={period === p ? "active" : ""}
            aria-pressed={period === p}
            onClick={() =>
              onChange(
                p === "custom"
                  ? filter
                  : {
                      ...filter,
                      ...periodRange(p, today(state.profile.timezone)),
                    },
                p,
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="report-filter-grid">
        <label>
          С даты
          <BrandDate
            aria-label="Аналитика с даты"
            value={filter.from}
            onChange={(e) =>
              onChange({ ...filter, from: e.target.value }, "custom")
            }
          />
        </label>
        <label>
          По дату
          <BrandDate
            aria-label="Аналитика по дату"
            value={filter.to}
            max={today(state.profile.timezone)}
            onChange={(e) =>
              onChange({ ...filter, to: e.target.value }, "custom")
            }
          />
        </label>
        <label>
          Счёт
          <BrandSelect
            aria-label="Счёт"
            value={filter.account}
            onChange={(e) => set("account", e.target.value)}
          >
            <option value="">Все счета в {state.profile.currency}</option>
            {state.accounts
              .filter((a) => a.currency === state.profile.currency)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </BrandSelect>
        </label>
        <label>
          Категория
          <BrandSelect
            aria-label="Категория"
            value={filter.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Все категории</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.kind === "income" ? "доход" : "расход"}
              </option>
            ))}
          </BrandSelect>
        </label>
        <label>
          Тег
          <BrandSelect
            aria-label="Тег"
            value={filter.tag}
            onChange={(e) => set("tag", e.target.value)}
          >
            <option value="">Все события</option>
            {[...new Set(state.transactions.flatMap((t) => t.tags ?? []))]
              .sort()
              .map((t) => (
                <option key={t}>{t}</option>
              ))}
          </BrandSelect>
        </label>
        <label>
          Магазин / источник
          <BrandSelect
            aria-label="Магазин / источник"
            value={filter.merchant}
            onChange={(e) => set("merchant", e.target.value)}
          >
            <option value="">Все получатели и источники</option>
            {[
              ...new Set(
                state.transactions.map((t) => t.merchant).filter(Boolean),
              ),
            ]
              .sort()
              .map((t) => (
                <option key={t}>{t}</option>
              ))}
          </BrandSelect>
        </label>
      </div>
    </section>
  );
}
