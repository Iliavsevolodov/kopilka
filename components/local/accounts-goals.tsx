"use client";
import { Glyph } from "./glyph";
import { useState } from "react";
import { Plus, Wallet, Archive, ArrowUpRight, Target } from "lucide-react";
import { useFinance } from "./provider";
import { useEntry } from "./workspace";
import { balances, goalMonthly, metrics } from "@/lib/local/finance";
import { Money, Progress, Empty, Modal, Field } from "./ui";
import { parseMajorToMinor } from "@/lib/finance/money";
import { today } from "@/lib/local/model";
export function Accounts() {
  const { state, update } = useFinance(),
    open = useEntry();
  const [archive, setArchive] = useState<string | null>(null),
    [error, setError] = useState("");
  const accounts = balances(state);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ДЕНЬГИ НА СВОИХ МЕСТАХ</div>
          <h1>Мои счета</h1>
          <p>Карты, наличные и накопления — полная картина</p>
        </div>
        <button className="btn-primary" onClick={() => open("account")}>
          <Plus size={18} />
          Добавить счёт
        </button>
      </div>
      <div className="account-grid">
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <section className="card account-card" key={a.id}>
              <div className="account-card-top">
                <span style={{ background: a.color }}>
                  <Wallet size={22} />
                </span>
                <span className="tiny-tag">{a.currency}</span>
                <button
                  className="icon-button"
                  aria-label={`Архивировать ${a.name}`}
                  onClick={() => setArchive(a.id)}
                >
                  <Archive size={17} />
                </button>
              </div>
              <h2>{a.name}</h2>
              <strong className="big-number">
                <Money value={a.balanceMinor} currency={a.currency} />
              </strong>
              <label className="check">
                <input
                  type="checkbox"
                  checked={a.includeInTotal}
                  onChange={() =>
                    void update((s) => ({
                      ...s,
                      accounts: s.accounts.map((x) =>
                        x.id === a.id
                          ? { ...x, includeInTotal: !x.includeInTotal }
                          : x,
                      ),
                    }))
                  }
                />
                Включать в общий баланс
              </label>
              <button className="text-button" onClick={() => open("transfer")}>
                Перевести между счетами <ArrowUpRight size={16} />
              </button>
            </section>
          ))}
        <button className="add-account" onClick={() => open("account")}>
          <Plus size={26} />
          Ещё один счёт
        </button>
      </div>
      <div className="info-box">
        Суммы разных валют не складываются. Главная и аналитика показывают
        основную валюту: {state.profile.currency}. Архивирование сохраняет
        операции и баланс счёта; включение в общий итог настраивается отдельно.
      </div>
      <button className="btn-secondary" onClick={() => open("adjustment")}>
        Сверить и скорректировать баланс
      </button>
      {accounts.some((a) => a.archived) && (
        <section className="card archived">
          <h2>Архив счетов</h2>
          {accounts
            .filter((a) => a.archived)
            .map((a) => (
              <div className="subscription-row" key={a.id}>
                <strong>{a.name}</strong>
                <Money value={a.balanceMinor} currency={a.currency} />
                <button
                  className="text-button"
                  onClick={() =>
                    void update((s) => ({
                      ...s,
                      accounts: s.accounts.map((x) =>
                        x.id === a.id ? { ...x, archived: false } : x,
                      ),
                    }))
                  }
                >
                  Восстановить
                </button>
              </div>
            ))}
        </section>
      )}
      {archive && (
        <Modal title="Архивировать счёт?" onClose={() => setArchive(null)}>
          <p>
            История и баланс сохранятся. Счёт нельзя будет выбрать для новых
            операций.
          </p>
          <p className="hint">
            Сначала приостановите его регулярные платежи, если они настроены.
          </p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button
            className="btn-primary"
            onClick={async () => {
              try {
                await update((s) => {
                  if (
                    s.recurring.some((r) => r.accountId === archive && r.active)
                  )
                    throw new Error(
                      "У счёта есть активные регулярные платежи. Приостановите их в разделе «План».",
                    );
                  return {
                    ...s,
                    accounts: s.accounts.map((a) =>
                      a.id === archive ? { ...a, archived: true } : a,
                    ),
                  };
                });
                setArchive(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Не удалось сохранить",
                );
              }
            }}
          >
            Архивировать
          </button>
        </Modal>
      )}
    </>
  );
}
export function Goals() {
  const { state, update } = useFinance(),
    open = useEntry();
  const [selected, setSelected] = useState<string | null>(null),
    [archive, setArchive] = useState<string | null>(null),
    [error, setError] = useState("");
  const goals = state.goals.filter((g) => !g.archived);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">У КАЖДОЙ МЕЧТЫ ЕСТЬ ПЛАН</div>
          <h1>Финансовые цели</h1>
          <p>Резервируйте деньги, которые уже есть на ваших счетах</p>
        </div>
        <button className="btn-primary" onClick={() => open("goal")}>
          <Plus size={18} />
          Новая цель
        </button>
      </div>
      <div className="goals-grid">
        {goals.map((g) => (
          <section className="card goal-card" key={g.id}>
            <div className="goal-card-icon">
              <Glyph value={g.icon} size={30} />
            </div>
            <div className="section-title">
              <h2>{g.name}</h2>
              <button
                className="icon-button"
                aria-label={`Архивировать ${g.name}`}
                onClick={() => setArchive(g.id)}
              >
                <Archive size={17} />
              </button>
            </div>
            <div className="goal-amount">
              <strong>
                <Money value={g.savedMinor} />
              </strong>
              <span>
                из <Money value={g.targetMinor} />
              </span>
            </div>
            <Progress value={g.savedMinor / g.targetMinor} />
            <div className="goal-stats">
              <span>
                {Math.round((g.savedMinor / g.targetMinor) * 100)}% накоплено
              </span>
              <span>до {new Date(g.date).toLocaleDateString("ru-RU")}</span>
            </div>
            <div className="goal-recommendation">
              <Target size={19} />
              <p>
                {g.savedMinor >= g.targetMinor ? (
                  "Цель достигнута — у вас получилось!"
                ) : (
                  <>
                    Откладывайте{" "}
                    <strong>
                      <Money
                        value={goalMonthly(
                          g.targetMinor,
                          g.savedMinor,
                          g.date,
                          today(state.profile.timezone),
                        )}
                      />
                    </strong>{" "}
                    в месяц для достижения цели.
                  </>
                )}
              </p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                setError("");
                setSelected(g.id);
              }}
            >
              Изменить резерв
            </button>
          </section>
        ))}
      </div>
      {!goals.length && (
        <section className="card">
          <Empty
            title="На что хочется накопить?"
            text="Путешествие, свой дом или новая возможность. Добавьте цель — Копилка рассчитает ежемесячный взнос."
            action={
              <button className="btn-primary" onClick={() => open("goal")}>
                Создать первую цель
              </button>
            }
          />
        </section>
      )}
      {state.goals.some((g) => g.archived) && (
        <section className="card archived">
          <h2>Архив целей</h2>
          {state.goals
            .filter((g) => g.archived)
            .map((g) => (
              <p key={g.id}>
                {g.icon} {g.name} · резерв освобождён
              </p>
            ))}
        </section>
      )}
      {selected && (
        <Modal title="Резерв на цель" onClose={() => setSelected(null)}>
          <form
            className="entry-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const amount = parseMajorToMinor(
                  String(new FormData(e.currentTarget).get("saved")),
                );
                await update((s) => {
                  const g = s.goals.find((g) => g.id === selected)!;
                  const m = metrics(s),
                    other = s.goals
                      .filter((g) => !g.archived && g.id !== selected)
                      .reduce((n, g) => n + g.savedMinor, 0);
                  if (amount < 0 || amount > g.targetMinor)
                    throw new Error("Резерв должен быть от 0 до суммы цели");
                  if (amount + other > m.liquid)
                    throw new Error("Недостаточно денег на ликвидных счетах");
                  return {
                    ...s,
                    goals: s.goals.map((g) =>
                      g.id === selected ? { ...g, savedMinor: amount } : g,
                    ),
                  };
                });
                setSelected(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Не удалось сохранить",
                );
              }
            }}
          >
            <Field label="Всего выделено на цель">
              <input
                name="saved"
                inputMode="decimal"
                defaultValue={
                  state.goals.find((g) => g.id === selected)!.savedMinor / 100
                }
                required
              />
            </Field>
            <p className="hint">
              Резерв не создаёт расход и не увеличивает баланс. Он уменьшает
              сумму, которую можно свободно потратить.
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="btn-primary">Сохранить резерв</button>
          </form>
        </Modal>
      )}
      {archive && (
        <Modal title="Архивировать цель?" onClose={() => setArchive(null)}>
          <p>
            Деньги останутся на ваших счетах. Резерв этой цели будет освобождён.
          </p>
          <button
            className="btn-primary"
            onClick={async () => {
              await update((s) => ({
                ...s,
                goals: s.goals.map((g) =>
                  g.id === archive ? { ...g, archived: true } : g,
                ),
              }));
              setArchive(null);
            }}
          >
            Архивировать цель
          </button>
        </Modal>
      )}
    </>
  );
}
