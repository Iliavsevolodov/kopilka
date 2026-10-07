"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck, Sprout } from "lucide-react";
import { useFinance } from "./provider";
import { Field } from "./ui";
import { parseMajorToMinor } from "@/lib/finance/money";
import {
  accountSchema,
  profileSchema,
  uid,
  type State,
} from "@/lib/local/model";
export function Onboarding() {
  const { update, demo } = useFinance();
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    currency: "RUB",
    balance: "",
    income: "",
    mandatory: "",
    reserve: "3",
  });
  async function next(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (step === 0) {
        if (!draft.name.trim()) throw new Error("Как к вам обращаться?");
        setStep(1);
        return;
      }
      if (step === 1) {
        parseMajorToMinor(draft.balance || "0");
        setStep(2);
        return;
      }
      const profile = profileSchema.parse({
        name: draft.name,
        currency: draft.currency,
        monthlyIncomeMinor: parseMajorToMinor(draft.income || "0"),
        mandatoryMinor: parseMajorToMinor(draft.mandatory || "0"),
        reserveMonths: Number(draft.reserve),
        onboarded: true,
        theme: "system",
        hidden: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await update(
        (s) =>
          ({
            ...s,
            profile,
            accounts: [
              accountSchema.parse({
                id: uid(),
                name: "Основная карта",
                type: "card",
                initialMinor: parseMajorToMinor(draft.balance || "0"),
                currency: draft.currency,
                includeInTotal: true,
                archived: false,
                color: "#19765f",
              }),
            ],
          }) as State,
      );
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Проверьте введённые значения",
      );
    }
  }
  const input = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft({ ...draft, [key]: e.target.value }),
  });
  return (
    <main className="onboarding">
      <div className="onboard-brand">
        <span className="brand-icon">
          <Sprout />
        </span>
        KOPILKA
      </div>
      <div className="onboard-layout">
        <section>
          <span className="eyebrow">МЕНЬШЕ ТРЕВОГИ. БОЛЬШЕ ВОЗМОЖНОСТЕЙ.</span>
          <h1>
            Ваши деньги.
            <br />
            <em>Ваше завтра.</em>
          </h1>
          <p>
            Разберёмся с финансами, соберём понятный план и освободим место для
            того, что действительно важно.
          </p>
          <div className="onboard-promise">
            <ShieldCheck />
            <span>
              Данные остаются в этом браузере.
              <br />
              Начните без регистрации и подключения банка.
            </span>
          </div>
          <button className="btn-secondary" onClick={demo}>
            Сначала посмотреть демопример <ArrowRight size={17} />
          </button>
        </section>
        <form className="card onboard-form" onSubmit={next}>
          <div className="step-indicator">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i <= step ? "active" : ""} />
            ))}
          </div>
          <span className="eyebrow">ШАГ {step + 1} ИЗ 3</span>
          <h2>
            {
              [
                "Давайте познакомимся",
                "С чего начинаем?",
                "Настроим ваш ориентир",
              ][step]
            }
          </h2>
          <p className="muted">
            {
              [
                "Как к вам обращаться и в какой валюте считать?",
                "Укажите деньги на основной карте. Другие счета можно добавить позже.",
                "Эти оценки помогут построить первый прогноз. Позже их можно изменить.",
              ][step]
            }
          </p>
          {step === 0 ? (
            <>
              <Field label="Ваше имя">
                <input
                  required
                  maxLength={60}
                  placeholder="Например, Илья"
                  {...input("name")}
                />
              </Field>
              <Field label="Основная валюта">
                <select {...input("currency")}>
                  <option value="RUB">Российский рубль · ₽</option>
                  <option value="USD">Доллар США · $</option>
                  <option value="EUR">Евро · €</option>
                </select>
              </Field>
            </>
          ) : step === 1 ? (
            <Field label="Сколько денег на основной карте?">
              <input
                inputMode="decimal"
                placeholder="0"
                {...input("balance")}
              />
            </Field>
          ) : (
            <>
              <Field label="Средний доход в месяц">
                <input
                  inputMode="decimal"
                  placeholder="150 000"
                  {...input("income")}
                />
              </Field>
              <Field label="Обязательные расходы в месяц">
                <input
                  inputMode="decimal"
                  placeholder="35 000"
                  {...input("mandatory")}
                />
              </Field>
              <Field label="Желаемая подушка">
                <select {...input("reserve")}>
                  <option value="1">На 1 месяц</option>
                  <option value="3">На 3 месяца</option>
                  <option value="6">На 6 месяцев</option>
                </select>
              </Field>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="btn-primary">
            {step === 2 ? "Открыть мою Копилку" : "Продолжить"}
            <ArrowRight size={18} />
          </button>
          {step > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setStep(step - 1)}
            >
              Вернуться назад
            </button>
          )}
        </form>
      </div>
      <footer>УЧЁТ → ПОНИМАНИЕ → ПЛАН → ВАШИ ЦЕЛИ</footer>
    </main>
  );
}
