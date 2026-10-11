"use client";
import { BrandSelect, BrandDate } from "./branded-controls";
import { Fragment, useState } from "react";
import { useFinance } from "./provider";
import { Field, Modal, Money } from "./ui";
import { allocatedAmounts, refundable } from "@/lib/local/ledger";
import { addTransaction, editTransaction } from "@/lib/local/finance";
import { today, uid, type Transaction } from "@/lib/local/model";
import { parseMajorToMinor } from "@/lib/finance/money";
export function PurchaseActions({
  transaction: t,
  mode,
  onClose,
}: {
  transaction: Transaction;
  mode: "split" | "refund";
  onClose: () => void;
}) {
  const { state, update } = useFinance();
  const [parts, setParts] = useState(
    t.allocations ?? [
      { categoryId: t.categoryId ?? "", amountMinor: t.amountMinor },
      { categoryId: "", amountMinor: 0 },
    ],
  );
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const categories = state.categories.filter((c) => c.kind === "expense");
  const currency = state.accounts.find((a) => a.id === t.accountId)?.currency;
  return (
    <Modal
      title={mode === "split" ? "Разделить покупку" : "Возврат покупки"}
      onClose={onClose}
    >
      <form
        className="entry-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setSaving(true);
          setError("");
          try {
            await update((s) => {
              if (mode === "split")
                return editTransaction(s, {
                  ...t,
                  allocations: parts.map((_, i) => ({
                    categoryId: String(fd.get(`category-${i}`)),
                    amountMinor: parseMajorToMinor(
                      String(fd.get(`amount-${i}`)),
                    ),
                  })),
                });
              return addTransaction(s, {
                id: uid(),
                type: "income",
                amountMinor: parseMajorToMinor(String(fd.get("amount"))),
                accountId: String(fd.get("account")),
                categoryId: String(fd.get("category")),
                refundOf: t.id,
                date: String(fd.get("date")),
                description: `Возврат: ${t.description || "покупка"}`.slice(
                  0,
                  300,
                ),
                mandatory: false,
                impulsive: false,
                source: "manual",
                createdAt: new Date().toISOString(),
              });
            });
            onClose();
          } catch (e) {
            setError(
              e instanceof Error && e.name !== "ZodError"
                ? e.message
                : "Проверьте сумму и категории",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <p className="hint">
          Покупка: <Money value={t.amountMinor} currency={currency} />.{" "}
          {mode === "split"
            ? "Сумма частей должна совпадать с покупкой; баланс не изменится."
            : "Возврат уменьшит расходы на дату поступления денег."}
        </p>
        {mode === "split" ? (
          parts.map((part, i) => (
            <Fragment key={i}>
              <Field label={`Категория части ${i + 1}`}>
                <BrandSelect
                  name={`category-${i}`}
                  required
                  defaultValue={part.categoryId}
                >
                  <option value="">Выберите категорию</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </BrandSelect>
              </Field>
              <Field label={`Сумма части ${i + 1}`}>
                <input
                  name={`amount-${i}`}
                  inputMode="decimal"
                  required
                  defaultValue={String(part.amountMinor / 100)}
                />
              </Field>
            </Fragment>
          ))
        ) : (
          <>
            <Field label="Категория возврата">
              <BrandSelect name="category">
                {allocatedAmounts(t).map((a) => (
                  <option key={a.categoryId} value={a.categoryId}>
                    {categories.find((c) => c.id === a.categoryId)?.name} ·{" "}
                    {state.profile.hidden
                      ? "•••"
                      : new Intl.NumberFormat("ru-RU", {
                          style: "currency",
                          currency,
                        }).format(
                          refundable(state, t, a.categoryId) / 100,
                        )}{" "}
                    осталось
                  </option>
                ))}
              </BrandSelect>
            </Field>
            <Field label="Сумма возврата">
              <input name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Счёт возврата">
              <BrandSelect name="account" defaultValue={t.accountId}>
                {state.accounts
                  .filter((a) => !a.archived && a.currency === currency)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </BrandSelect>
            </Field>
            <Field label="Дата возврата">
              <BrandDate
                name="date"
                min={t.date}
                max={today(state.profile.timezone)}
                defaultValue={today(state.profile.timezone)}
                required
              />
            </Field>
          </>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {mode === "split" && (
          <div className="split-controls">
            <button
              type="button"
              className="text-button"
              disabled={parts.length >= 10}
              onClick={() =>
                setParts([...parts, { categoryId: "", amountMinor: 0 }])
              }
            >
              Добавить часть
            </button>
            <button
              type="button"
              className="text-button"
              disabled={parts.length <= 2}
              onClick={() => setParts(parts.slice(0, -1))}
            >
              Убрать последнюю
            </button>
          </div>
        )}
        <button className="btn-primary" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
