"use client";
import { useId, useState } from "react";
import { formatMoney } from "@/lib/finance/money";
import { useFinance } from "./provider";
export const chartColors = [
  "#21866c",
  "#9fba9a",
  "#ccb98f",
  "#9799c8",
  "#df9979",
  "#81b3be",
  "#b8a2af",
];
export function BalanceChart({
  points,
  forecast = false,
}: {
  points: { date: string; balance: number }[];
  forecast?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const { state } = useFinance();
  const [hover, setHover] = useState<number | null>(null);
  const min = Math.min(...points.map((p) => p.balance)),
    max = Math.max(...points.map((p) => p.balance));
  const range = max - min || 100;
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${40 + (i / Math.max(1, points.length - 1)) * 660},${160 - ((p.balance - min) / range) * 130}`,
    )
    .join(" ");
  const point = hover !== null ? points[hover] : undefined;
  return (
    <div className="chart-wrap">
      <svg
        viewBox="0 0 740 220"
        role="img"
        aria-label={`${forecast ? "Прогноз" : "Динамика"} баланса: ${points.length} дней`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#21866c" stopOpacity=".18" />
            <stop offset="1" stopColor="#21866c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 95, 160].map((y, i) => (
          <g key={y}>
            <line
              x1="40"
              x2="700"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
            <text x="40" y={y - 9} fill="var(--muted)" fontSize="10">
              {state.profile.hidden
                ? "•••"
                : formatMoney(
                    Math.round((max - (range * i) / 2) / 100000) * 100000,
                    state.profile.currency,
                  )}
            </text>
          </g>
        ))}
        <path d={`${path} L700,185 L40,185 Z`} fill={`url(#${id})`} />
        <path
          d={path}
          fill="none"
          stroke="#21866c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={forecast ? "6 5" : undefined}
        />
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(
          (i, j) => (
            <text
              key={`${i}-${j}`}
              x={40 + (i / Math.max(1, points.length - 1)) * 660}
              y="210"
              textAnchor={j === 0 ? "start" : j === 2 ? "end" : "middle"}
              fill="var(--muted)"
              fontSize="11"
            >
              {new Intl.DateTimeFormat("ru-RU", {
                day: "numeric",
                month: "short",
              }).format(new Date(points[i].date))}
            </text>
          ),
        )}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={35 + (i / Math.max(1, points.length - 1)) * 660}
            y="20"
            width={Math.max(5, 660 / points.length)}
            height="170"
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {point && (
          <circle
            cx={40 + (hover! / Math.max(1, points.length - 1)) * 660}
            cy={160 - ((point.balance - min) / range) * 130}
            r="5"
            fill="#21866c"
            stroke="var(--surface)"
            strokeWidth="3"
          />
        )}
      </svg>
      <div className="chart-caption">
        {point
          ? `${point.date} · ${state.profile.hidden ? "••••" : formatMoney(point.balance, state.profile.currency)}`
          : forecast
            ? "Расчётная траектория, а не гарантированный результат"
            : "Фактический баланс на конец каждого дня"}
      </div>
    </div>
  );
}
export function Donut({
  items,
  total,
}: {
  items: { name: string; amount: number }[];
  total: number;
}) {
  const { state } = useFinance();
  return (
    <div className="donut">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label="Распределение расходов по категориям"
      >
        <circle
          cx="100"
          cy="100"
          r="77"
          stroke="var(--surface-muted)"
          strokeWidth="22"
          fill="none"
        />
        {items.map((item, i) => {
          const percent = total ? (item.amount / total) * 100 : 0;
          const start = total
            ? (items.slice(0, i).reduce((n, x) => n + x.amount, 0) / total) *
              100
            : 0;
          return (
            <circle
              key={item.name}
              cx="100"
              cy="100"
              r="77"
              pathLength="100"
              fill="none"
              stroke={chartColors[i % chartColors.length]}
              strokeWidth="22"
              strokeDasharray={`${Math.max(0, percent - 0.7)} ${100 - Math.max(0, percent - 0.7)}`}
              strokeDashoffset={-start}
              transform="rotate(-90 100 100)"
            >
              <title>
                {item.name}:{" "}
                {state.profile.hidden
                  ? "•••"
                  : formatMoney(item.amount, state.profile.currency)}
              </title>
            </circle>
          );
        })}
      </svg>
      <div>
        <small>ВСЕГО РАСХОДЫ</small>
        <strong>
          {state.profile.hidden
            ? "••••••"
            : formatMoney(total, state.profile.currency)}
        </strong>
        <span>в этом месяце</span>
      </div>
    </div>
  );
}
