"use client";
import { BrandDate } from "./branded-controls";
import { useState } from "react";
import Link from "next/link";
import { useFinance } from "./provider";
import {
  attentionItems,
  suggestedNextDate,
  type AttentionItem,
} from "@/lib/local/attention";
import { EntryForm } from "./forms";
import { Field, Modal, Money } from "./ui";
import { recurringSchema, today, uid } from "@/lib/local/model";
import { parseMajorToMinor } from "@/lib/finance/money";
export function Attention() {
  const { state, update } = useFinance(),
    items = attentionItems(state);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<AttentionItem | null>(null),
    [page, setPage] = useState(0),
    [error, setError] = useState("");
  const current = Math.min(page, Math.max(0, Math.ceil(items.length / 5) - 1));
  return (
    <section className="card attention" id="attention">
      <div className="eyebrow">ПОРЯДОК В ДАННЫХ</div>
      <h2>
        Требует внимания <span className="muted">{items.length}</span>
      </h2>
      <p className="muted">
        Подсказки ничего не меняют без вашего подтверждения.
      </p>
      {!items.length && (
        <p>Все замеченные вопросы разобраны. Продолжайте добавлять операции.</p>
      )}
      {items.slice(current * 5, current * 5 + 5).map((item) => (
        <article className="attention-item" key={item.id}>
          <div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.transaction && (
              <strong>
                <Money
                  value={item.transaction.amountMinor}
                  currency={
                    state.accounts.find(
                      (a) => a.id === item.transaction?.accountId,
                    )?.currency
                  }
                />
              </strong>
            )}
          </div>
          <div className="button-row">
            {item.kind === "payment" ? (
              <Link className="btn-secondary" href="/plan">
                Проверить в плане
              </Link>
            ) : item.kind === "duplicate" ? (
              <Link
                className="btn-secondary"
                href={`/transactions?from=${item.transaction!.date}&to=${item.transaction!.date}&account=${item.transaction!.accountId}`}
              >
                Проверить операции
              </Link>
            ) : (
              <button className="btn-secondary" onClick={() => setActive(item)}>
                {item.kind === "category"
                  ? "Указать категорию"
                  : "Проверить шаблон"}
              </button>
            )}
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await update((s) => ({
                    ...s,
                    dismissedAttention: [
                      ...(s.dismissedAttention ?? []),
                      item.id,
                    ],
                  }));
                } catch {
                  setError("Не удалось скрыть рекомендацию");
                }
              }}
            >
              Скрыть
            </button>
          </div>
        </article>
      ))}
      {items.length > 5 && (
        <div className="pagination">
          <button
            className="text-button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Назад
          </button>
          <span>
            {current + 1} / {Math.ceil(items.length / 5)}
          </span>
          <button
            className="text-button"
            disabled={(current + 1) * 5 >= items.length}
            onClick={() => setPage(current + 1)}
          >
            Далее
          </button>
        </div>
      )}
      {!!state.dismissedAttention?.length && (
        <button
          className="text-button"
          onClick={async () => {
            try {
              await update((s) => ({ ...s, dismissedAttention: [] }));
            } catch {
              setError("Не удалось восстановить рекомендации");
            }
          }}
        >
          Показать скрытые рекомендации ({state.dismissedAttention.length})
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {active?.kind === "category" && (
        <EntryForm
          kind={active.transaction!.type}
          initial={active.transaction}
          onClose={() => setActive(null)}
        />
      )}
      {active?.kind === "recurring" && (
        <Modal
          title="Проверить регулярный платёж"
          onClose={() => {
            setActive(null);
            setError("");
          }}
        >
          <form
            className="entry-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setSaving(true);
              try {
                await update((s) => ({
                  ...s,
                  recurring: [
                    ...s.recurring,
                    recurringSchema.parse({
                      id: uid(),
                      name: String(fd.get("name")),
                      type: active.transaction!.type,
                      amountMinor: parseMajorToMinor(String(fd.get("amount"))),
                      accountId: active.transaction!.accountId,
                      categoryId: active.transaction!.categoryId,
                      day: Number(String(fd.get("date")).slice(-2)),
                      startDate: String(fd.get("date")),
                      active: true,
                      mandatory: fd.has("mandatory"),
                    }),
                  ],
                  dismissedAttention: [
                    ...(s.dismissedAttention ?? []),
                    active.id,
                  ],
                }));
                setActive(null);
              } catch {
                setError("Проверьте дату, название и сумму");
              } finally {
                setSaving(false);
              }
            }}
          >
            <Field label="Название">
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={
                  active.transaction!.merchant ||
                  active.transaction!.description
                }
              />
            </Field>
            <Field label="Сумма">
              <input
                name="amount"
                required
                inputMode="decimal"
                defaultValue={active.transaction!.amountMinor / 100}
              />
            </Field>
            <Field label="Первый ожидаемый платёж">
              <BrandDate
                name="date"
                required
                min={today(state.profile.timezone)}
                defaultValue={
                  suggestedNextDate(active.transaction!) <
                  today(state.profile.timezone)
                    ? today(state.profile.timezone)
                    : suggestedNextDate(active.transaction!)
                }
              />
            </Field>
            <label className="check">
              <input
                name="mandatory"
                type="checkbox"
                defaultChecked={active.transaction!.mandatory}
              />
              Обязательный платёж
            </label>
            <p className="hint">
              Повторение каждый месяц. Это шаблон; он не изменяет фактический
              баланс.
            </p>
            {error && <p role="alert">{error}</p>}
            <button className="btn-primary" disabled={saving}>
              {saving ? "Сохраняем…" : "Создать шаблон"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
