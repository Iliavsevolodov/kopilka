"use client";
import { useState, type FormEvent } from "react";
import { useFinance } from "./provider";
import { Field, Modal } from "./ui";
import { parseMajorToMinor } from "@/lib/finance/money";
import {
  accountSchema,
  budgetSchema,
  categorySchema,
  goalSchema,
  recurringSchema,
  today,
  uid,
  type Transaction,
} from "@/lib/local/model";
import { addTransaction, balances } from "@/lib/local/finance";
export type FormKind =
  | "expense"
  | "income"
  | "transfer"
  | "adjustment"
  | "account"
  | "budget"
  | "goal"
  | "recurring"
  | "category";
const titles: Record<FormKind, string> = {
  expense: "Новый расход",
  income: "Новый доход",
  transfer: "Перевод между счетами",
  adjustment: "Корректировка баланса",
  account: "Новый счёт",
  budget: "Новый бюджет",
  goal: "Новая цель",
  recurring: "Регулярный платёж",
  category: "Новая категория",
};
export function EntryForm({
  kind,
  onClose,
}: {
  kind: FormKind;
  onClose: () => void;
}) {
  const { state, update } = useFinance();
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [type, setType] = useState<"expense" | "income">(
      kind === "income" ? "income" : "expense",
    );
  const accounts = state.accounts.filter((a) => !a.archived);
  const categories = state.categories.filter(
    (c) => !c.archived && c.kind === type,
  );
  const transaction = ["expense", "income", "transfer", "adjustment"].includes(
    kind,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const str = (key: string) => String(fd.get(key) ?? "");
    const amount = (key = "amount") => parseMajorToMinor(str(key) || "0");
    try {
      await update((s) => {
        const id = uid();
        if (transaction) {
          const t: Transaction = {
            id,
            type: kind as Transaction["type"],
            amountMinor: amount(),
            accountId: str("account"),
            destinationAccountId:
              kind === "transfer" ? str("destination") : undefined,
            categoryId:
              kind === "income" || kind === "expense"
                ? str("category")
                : undefined,
            date: str("date"),
            description: str("description"),
            mandatory: str("behavior") === "mandatory",
            impulsive: str("behavior") === "impulsive",
            source: "manual",
            createdAt: new Date().toISOString(),
          };
          return addTransaction(s, t);
        }
        if (kind === "account") {
          const a = accountSchema.parse({
            id,
            name: str("name"),
            type: str("accountType"),
            initialMinor: amount(),
            currency: str("currency"),
            includeInTotal: fd.has("include"),
            archived: false,
            color: str("color"),
          });
          return { ...s, accounts: [...s.accounts, a] };
        }
        if (kind === "budget") {
          if (s.budgets.some((b) => b.categoryId === str("category")))
            throw new Error("Для этой категории уже есть бюджет");
          return {
            ...s,
            budgets: [
              ...s.budgets,
              budgetSchema.parse({
                id,
                categoryId: str("category"),
                limitMinor: amount(),
              }),
            ],
          };
        }
        if (kind === "goal") {
          const goal = goalSchema.parse({
            id,
            name: str("name"),
            targetMinor: amount(),
            savedMinor: amount("saved"),
            date: str("date"),
            icon: str("icon"),
            archived: false,
          });
          const liquid = balances(s)
            .filter(
              (a) =>
                a.includeInTotal &&
                a.currency === s.profile.currency &&
                !["deposit", "investment"].includes(a.type),
            )
            .reduce((n, a) => n + a.balanceMinor, 0);
          const reserved = s.goals
            .filter((g) => !g.archived)
            .reduce((n, g) => n + g.savedMinor, 0);
          if (goal.savedMinor + reserved > liquid)
            throw new Error("На счетах недостаточно денег для такого резерва");
          return { ...s, goals: [...s.goals, goal] };
        }
        if (kind === "recurring")
          return {
            ...s,
            recurring: [
              ...s.recurring,
              recurringSchema.parse({
                id,
                name: str("name"),
                type,
                amountMinor: amount(),
                accountId: str("account"),
                categoryId: str("category"),
                day: Number(str("day")),
                startDate: str("date"),
                active: true,
                mandatory: fd.has("mandatory"),
              }),
            ],
          };
        return {
          ...s,
          categories: [
            ...s.categories,
            categorySchema.parse({
              id,
              name: str("name"),
              icon: str("icon"),
              kind: type,
              archived: false,
            }),
          ],
        };
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.name === "ZodError"
            ? "Проверьте сумму, название и дату"
            : err.message
          : "Не удалось сохранить. Проверьте доступ к хранилищу браузера.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={titles[kind]} onClose={onClose}>
      <form onSubmit={submit} className="entry-form">
        {["account", "goal", "recurring", "category"].includes(kind) && (
          <Field label="Название">
            <input
              name="name"
              required
              maxLength={60}
              autoFocus
              placeholder={
                kind === "goal"
                  ? "Например, большое путешествие"
                  : "Введите название"
              }
            />
          </Field>
        )}
        {["recurring", "category"].includes(kind) && (
          <Field label="Тип">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </Field>
        )}
        {kind !== "category" && (
          <Field
            label={
              kind === "account"
                ? "Начальный баланс"
                : kind === "budget"
                  ? "Лимит на месяц"
                  : kind === "goal"
                    ? "Сумма цели"
                    : kind === "adjustment"
                      ? "Изменение баланса (можно со знаком минус)"
                      : "Сумма"
            }
          >
            <div className="amount-input">
              <input
                name="amount"
                inputMode="decimal"
                required
                autoFocus={transaction}
                placeholder="0"
                aria-label="Сумма"
              />
              <span>{state.profile.currency}</span>
            </div>
          </Field>
        )}
        {(kind === "expense" ||
          kind === "income" ||
          kind === "budget" ||
          kind === "recurring") && (
          <Field label="Категория">
            <select name="category" required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {(transaction || kind === "recurring") && (
          <Field label={kind === "transfer" ? "Со счёта" : "Счёт"}>
            <select
              name="account"
              required
              defaultValue={
                typeof window !== "undefined"
                  ? (localStorage.getItem("kopilka.lastAccount") ??
                    accounts[0]?.id)
                  : accounts[0]?.id
              }
              onChange={(e) =>
                localStorage.setItem("kopilka.lastAccount", e.target.value)
              }
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === "transfer" && (
          <Field label="На счёт">
            <select name="destination" required defaultValue={accounts[1]?.id}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </Field>
        )}
        {(transaction || kind === "goal" || kind === "recurring") && (
          <Field
            label={
              kind === "goal"
                ? "К какой дате"
                : kind === "recurring"
                  ? "Начало расписания"
                  : "Дата"
            }
          >
            <input
              name="date"
              type="date"
              required
              defaultValue={today(state.profile.timezone)}
              max={transaction ? today(state.profile.timezone) : undefined}
            />
          </Field>
        )}
        {transaction && (
          <Field label="Комментарий">
            <input
              name="description"
              maxLength={300}
              placeholder="На что потратили или откуда доход"
            />
          </Field>
        )}
        {kind === "expense" && (
          <Field label="Характер расхода">
            <select name="behavior">
              <option value="normal">Обычный</option>
              <option value="mandatory">Обязательный</option>
              <option value="impulsive">Импульсивный</option>
            </select>
          </Field>
        )}
        {kind === "account" && (
          <>
            <div className="form-grid">
              <Field label="Тип счёта">
                <select name="accountType">
                  <option value="card">Карта / банковский счёт</option>
                  <option value="cash">Наличные</option>
                  <option value="savings">Накопительный</option>
                  <option value="deposit">Вклад</option>
                  <option value="investment">Инвестиционный</option>
                  <option value="wallet">Электронный кошелёк</option>
                  <option value="other">Другое</option>
                </select>
              </Field>
              <Field label="Валюта">
                <select name="currency" defaultValue={state.profile.currency}>
                  {["RUB", "USD", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Цвет счёта">
              <input name="color" type="color" defaultValue="#19765f" />
            </Field>
            <label className="check">
              <input type="checkbox" name="include" defaultChecked />
              Включать в общий баланс своей валюты
            </label>
          </>
        )}
        {kind === "goal" && (
          <>
            <Field label="Уже выделено на цель">
              <input name="saved" inputMode="decimal" defaultValue="0" />
            </Field>
            <p className="hint">
              Это резерв из денег на ваших счетах, а не новый доход. Резерв цели
              не должен включать финансовую подушку.
            </p>
          </>
        )}
        {(kind === "goal" || kind === "category") && (
          <Field label="Иконка">
            <select name="icon">
              {["🎯", "🌴", "🏡", "🚗", "💻", "🛒", "📚", "💰", "✨"].map(
                (i) => (
                  <option key={i}>{i}</option>
                ),
              )}
            </select>
          </Field>
        )}
        {kind === "recurring" && (
          <>
            <Field label="День каждого месяца">
              <input
                name="day"
                type="number"
                min="1"
                max="31"
                defaultValue="10"
                required
              />
            </Field>
            <label className="check">
              <input name="mandatory" type="checkbox" defaultChecked />
              Обязательный платёж
            </label>
            <p className="hint">
              В коротком месяце платёж переносится на последний день. Баланс
              изменится только после подтверждения.
            </p>
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn-primary"
          disabled={saving || (transaction && !accounts.length)}
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
        {transaction && !accounts.length && (
          <p className="hint">Сначала добавьте счёт в разделе «Мои счета».</p>
        )}
      </form>
    </Modal>
  );
}
