"use client";
import { BrandSelect, BrandDate } from "./branded-controls";
import { PurchaseActions } from "./purchase-actions";
import { CsvImport } from "./csv-import";
import { reportingEntries, removeTransaction } from "@/lib/local/ledger";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Pencil,
  SlidersHorizontal,
  Ellipsis,
  Upload,
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
  return (
    <Suspense fallback={<p role="status">Загружаем операции…</p>}>
      <TransactionRoute />
    </Suspense>
  );
}
function TransactionRoute() {
  const params = useSearchParams();
  return (
    <TransactionContent key={params.toString()} search={params.toString()} />
  );
}
function TransactionContent({ search }: { search: string }) {
  const param = (key: string) => new URLSearchParams(search).get(key) ?? "";
  const { state, update } = useFinance(),
    open = useEntry();
  const [query, setQuery] = useState(""),
    [type, setType] = useState(""),
    [account, setAccount] = useState(() => param("account")),
    [category, setCategory] = useState(() => param("category")),
    [from, setFrom] = useState(() => param("from")),
    [to, setTo] = useState(() => param("to")),
    [page, setPage] = useState(1),
    [remove, setRemove] = useState<string | null>(null),
    [error, setError] = useState("");
  const [tag, setTag] = useState(() => param("tag")),
    [merchant, setMerchant] = useState(() => param("merchant"));
  const [importing, setImporting] = useState(false);
  const [action, setAction] = useState<Transaction | null>(null);
  const [purchase, setPurchase] = useState<{
    transaction: Transaction;
    mode: "split" | "refund";
  } | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const filtered = [...state.transactions]
    .filter(
      (t) =>
        (!type || t.type === type) &&
        (!account ||
          t.accountId === account ||
          t.destinationAccountId === account) &&
        (!category ||
          (t.allocations
            ? t.allocations.some((a) => a.categoryId === category)
            : t.categoryId === category)) &&
        (!tag ||
          t.tags?.includes(tag) ||
          (t.refundOf &&
            state.transactions
              .find((x) => x.id === t.refundOf)
              ?.tags?.includes(tag))) &&
        (!merchant ||
          t.merchant === merchant ||
          (t.refundOf &&
            state.transactions.find((x) => x.id === t.refundOf)?.merchant ===
              merchant)) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        `${t.description} ${t.merchant ?? ""} ${t.tags?.join(" ") ?? ""} ${state.categories.find((c) => c.id === t.categoryId)?.name ?? ""}`
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
      [
        "Дата",
        "Тип",
        "Сумма",
        "Валюта",
        "Категория",
        "Счёт",
        "Описание",
        "Магазин",
        "Теги",
        "ID",
        "Части покупки",
        "Возврат покупки",
      ],
      ...filtered.map((t) => [
        t.date,
        t.refundOf ? "refund" : t.allocations ? "split" : t.type,
        (t.amountMinor / 100).toFixed(2),
        state.accounts.find((a) => a.id === t.accountId)?.currency ?? "",
        state.categories.find((c) => c.id === t.categoryId)?.name ?? "",
        state.accounts.find((a) => a.id === t.accountId)?.name ?? "",
        t.description,
        t.merchant ?? "",
        t.tags?.join(", ") ?? "",
        t.externalId ?? t.id,
        t.allocations ? JSON.stringify(t.allocations) : "",
        t.refundOf ?? "",
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
          <button
            className="btn-secondary"
            onClick={() => setImporting(!importing)}
          >
            <Upload size={17} /> Импорт CSV
          </button>
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
      {importing && <CsvImport onClose={() => setImporting(false)} />}
      <div className="filter-toolbar">
        <button
          className="btn-secondary"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={17} /> Фильтры
          {[type, account, category, from, to, tag, merchant].filter(Boolean)
            .length
            ? ` · ${[type, account, category, from, to, tag, merchant].filter(Boolean).length}`
            : ""}
        </button>
        <button
          className="text-button"
          onClick={() => {
            setQuery("");
            setTag("");
            setMerchant("");
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
        <BrandSelect
          aria-label="Тип операции"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Все типы</option>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
          <option value="transfer">Перевод</option>
          <option value="adjustment">Корректировка</option>
        </BrandSelect>
        <BrandSelect
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
        </BrandSelect>
        <BrandSelect
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
        </BrandSelect>
        <label className="date-filter">
          С
          <BrandDate
            aria-label="С даты"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="date-filter">
          По
          <BrandDate
            aria-label="По дату"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="report-filter-grid">
        <label>
          Тег
          <BrandSelect
            aria-label="Тег"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Все события</option>
            {[...new Set(state.transactions.flatMap((t) => t.tags ?? []))].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </BrandSelect>
        </label>
        <label>
          Магазин / источник
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Точное название"
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
                value={reportingEntries({
                  ...state,
                  transactions: state.transactions,
                })
                  .filter(
                    (t) =>
                      filtered.some((x) => x.id === t.id) &&
                      (!category || t.categoryId === category),
                  )
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
                      disabled={
                        !!t.refundOf ||
                        state.transactions.some((x) => x.refundOf === t.id)
                      }
                      title={
                        t.refundOf
                          ? "Для исправления удалите возврат и создайте заново"
                          : undefined
                      }
                      onClick={() => setEditing(t)}
                    >
                      <Pencil size={15} />
                    </button>
                    {t.type === "expense" && (
                      <button
                        className="icon-button"
                        aria-label={`Действия с покупкой ${t.description || "операция"}`}
                        onClick={() => setAction(t)}
                      >
                        <Ellipsis size={16} />
                      </button>
                    )}
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
      {action && (
        <Modal title="Действия с покупкой" onClose={() => setAction(null)}>
          <div className="action-list">
            <button
              className="btn-secondary"
              disabled={state.transactions.some(
                (t) => t.refundOf === action.id,
              )}
              onClick={() => {
                setPurchase({ transaction: action, mode: "split" });
                setAction(null);
              }}
            >
              Разделить по категориям
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setPurchase({ transaction: action, mode: "refund" });
                setAction(null);
              }}
            >
              Оформить возврат
            </button>
            <p className="hint">
              Покупку с возвратами нельзя перераспределить, пока возвраты не
              удалены.
            </p>
          </div>
        </Modal>
      )}
      {purchase && (
        <PurchaseActions {...purchase} onClose={() => setPurchase(null)} />
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
                    return removeTransaction(s, remove);
                  });
                  setRemove(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Не удалось сохранить изменения",
                  );
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
