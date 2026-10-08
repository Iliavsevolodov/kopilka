"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";
import { useFinance } from "./provider";
import { useEntry } from "./workspace";
import { TransactionRows } from "./dashboard";
import { Empty, Modal, download } from "./ui";
import { EntryForm } from "./forms";
import type { Transaction } from "@/lib/local/model";
import { Money } from "./ui";
import { formatMoney } from "@/lib/finance/money";
export function Transactions() {
  const { state, update } = useFinance(),
    open = useEntry();
  const [query, setQuery] = useState(""),
    [type, setType] = useState(""),
    [account, setAccount] = useState(""),
    [category, setCategory] = useState(() =>
      typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("category") ?? "")
        : "",
    ),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1),
    [remove, setRemove] = useState<string | null>(null),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const filtered = [...state.transactions]
    .filter(
      (t) =>
        (!type || t.type === type) &&
        (!account ||
          t.accountId === account ||
          t.destinationAccountId === account) &&
        (!category || t.categoryId === category) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        `${t.description} ${state.categories.find((c) => c.id === t.categoryId)?.name ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const dates = [...new Set(visible.map((t) => t.date))];
  function csv() {
    const safe = (v: string) =>
      `"${(/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
    const rows = [
      ["Дата", "Тип", "Сумма", "Валюта", "Категория", "Счёт", "Описание"],
      ...filtered.map((t) => [
        t.date,
        t.type,
        (t.amountMinor / 100).toFixed(2),
        state.accounts.find((a) => a.id === t.accountId)?.currency ?? "",
        state.categories.find((c) => c.id === t.categoryId)?.name ?? "",
        state.accounts.find((a) => a.id === t.accountId)?.name ?? "",
        t.description,
      ]),
    ];
    download(
      "kopilka-transactions.csv",
      "\uFEFF" + rows.map((r) => r.map(safe).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">КАЖДАЯ ЗАПИСЬ ДЕЛАЕТ КАРТИНУ ЯСНЕЕ</div>
          <h1>Операции</h1>
          <p>Все движения денег в одном месте</p>
        </div>
        <div className="button-row">
          <button className="btn-secondary" onClick={csv}>
            <Download size={17} />
            CSV
          </button>
          <button className="btn-primary" onClick={() => open("expense")}>
            <Plus size={18} />
            Добавить
          </button>
        </div>
      </div>
      <div className="filter-toolbar">
        <button
          className="btn-secondary"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={17} /> Фильтры
          {[type, account, category, from, to].filter(Boolean).length
            ? ` · ${[type, account, category, from, to].filter(Boolean).length}`
            : ""}
        </button>
        <button
          className="text-button"
          onClick={() => {
            setQuery("");
            setType("");
            setAccount("");
            setCategory("");
            setFrom("");
            setTo("");
            setPage(1);
          }}
        >
          Сбросить
        </button>
      </div>
      <div
        className={`card filters ${showFilters ? "filters-open" : "filters-compact"}`}
      >
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Поиск операций"
            placeholder="Поиск по названию и категории"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Тип операции"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Все типы</option>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
          <option value="transfer">Перевод</option>
          <option value="adjustment">Корректировка</option>
        </select>
        <select
          aria-label="Счёт"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">Все счета</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="date-filter">
          С
          <input
            aria-label="С даты"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="date-filter">
          По
          <input
            aria-label="По дату"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="transaction-totals">
        {[
          { type: "income", label: "Доходы" },
          { type: "expense", label: "Расходы" },
        ].map((item) => (
          <div key={item.type}>
            <small>
              {item.label} · {state.profile.currency}
            </small>
            <strong>
              <Money
                value={filtered
                  .filter(
                    (t) =>
                      t.type === item.type &&
                      state.accounts.find((a) => a.id === t.accountId)
                        ?.currency === state.profile.currency,
                  )
                  .reduce((sum, t) => sum + t.amountMinor, 0)}
              />
            </strong>
          </div>
        ))}
      </div>
      <div className="list-summary">
        <span>Найдено операций: {filtered.length}</span>
        <div className="button-row">
          <button className="text-button" onClick={() => open("income")}>
            + Доход
          </button>
          <button className="text-button" onClick={() => open("transfer")}>
            Перевод
          </button>
        </div>
      </div>
      {filtered.length ? (
        <section className="card history-card">
          {dates.map((date) => (
            <div key={date}>
              <h3 className="day-title">
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "long",
                  weekday: "long",
                }).format(new Date(date))}
              </h3>
              {visible
                .filter((t) => t.date === date)
                .map((t) => (
                  <div className="deletable-row" key={t.id}>
                    <TransactionRows transactions={[t]} />
                    <button
                      className="icon-button"
                      aria-label={`Редактировать ${t.description || "операцию"}`}
                      onClick={() => setEditing(t)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Удалить ${t.description || "операцию"}`}
                      onClick={() => setRemove(t.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
            </div>
          ))}
          <div className="pagination">
            <button
              className="btn-secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Назад
            </button>
            <span>
              {currentPage} / {pages}
            </span>
            <button
              className="btn-secondary"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Далее
            </button>
          </div>
        </section>
      ) : (
        <section className="card">
          <Empty
            title={
              state.transactions.length
                ? "Ничего не найдено"
                : "Здесь появится история расходов"
            }
            text={
              state.transactions.length
                ? "Попробуйте изменить фильтры или поисковый запрос."
                : "Добавьте первую операцию, чтобы Копилка начала анализировать ваши финансы."
            }
            action={
              <button className="btn-primary" onClick={() => open("expense")}>
                Добавить расход
              </button>
            }
          />
        </section>
      )}
      {editing && (
        <EntryForm
          key={editing.id}
          kind={editing.type}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {remove && (
        <Modal title="Удалить операцию?" onClose={() => setRemove(null)}>
          <p>
            Баланс и аналитика будут пересчитаны.{" "}
            {state.profile.hidden
              ? ""
              : formatMoney(
                  state.transactions.find((t) => t.id === remove)!.amountMinor,
                  state.accounts.find(
                    (a) =>
                      a.id ===
                      state.transactions.find((t) => t.id === remove)!
                        .accountId,
                  )?.currency,
                )}
          </p>
          <p className="hint">
            Подтверждённый регулярный платёж снова появится в плане.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="button-row">
            <button className="btn-secondary" onClick={() => setRemove(null)}>
              Оставить
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                try {
                  await update((s) => {
                    const t = s.transactions.find((t) => t.id === remove);
                    return {
                      ...s,
                      transactions: s.transactions.filter(
                        (t) => t.id !== remove,
                      ),
                      resolved: s.resolved.filter((k) => k !== t?.recurringKey),
                    };
                  });
                  setRemove(null);
                } catch {
                  setError("Не удалось сохранить изменения");
                }
              }}
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
