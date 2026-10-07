"use client";
import { DecisionAssistant } from "./intelligence";
import { Glyph } from "./glyph";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  Plus,
  Wallet,
  ChartNoAxesCombined,
  Target,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useFinance } from "./provider";
import { useEntry } from "./workspace";
import { Field, Modal, download } from "./ui";
import { profileSchema, stateSchema, type State } from "@/lib/local/model";
import { parseMajorToMinor } from "@/lib/finance/money";
import { validateState } from "@/lib/local/finance";
export function Profile() {
  const { state, update, demo, reset } = useFinance(),
    open = useEntry();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [deleting, setDeleting] = useState(false),
    [restore, setRestore] = useState<State | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ВАША КОПИЛКА, ВАШИ ПРАВИЛА</div>
          <h1>Финансовый профиль</h1>
          <p>Настройки, категории и управление данными</p>
        </div>
      </div>
      <div className="profile-shortcuts">
        <Link className="card" href="/accounts">
          <Wallet />
          Мои счета
        </Link>
        <Link className="card" href="/analytics">
          <ChartNoAxesCombined />
          Аналитика
        </Link>
        <Link className="card" href="/goals">
          <Target />
          Мои цели
        </Link>
      </div>
      {message && (
        <p className="success-box" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="planning-grid">
        <section className="card">
          <h2>Основные настройки</h2>
          <form
            className="entry-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const fd = new FormData(e.currentTarget);
                const profile = profileSchema.parse({
                  ...state.profile,
                  name: String(fd.get("name")),
                  currency: String(fd.get("currency")),
                  monthlyIncomeMinor: parseMajorToMinor(
                    String(fd.get("income")),
                  ),
                  mandatoryMinor: parseMajorToMinor(
                    String(fd.get("mandatory")),
                  ),
                  reserveMonths: Number(fd.get("reserve")),
                  theme: fd.get("theme"),
                  timezone: String(fd.get("timezone")),
                });
                await update((s) => {
                  if (
                    profile.currency !== s.profile.currency &&
                    (s.budgets.length || s.goals.some((g) => !g.archived))
                  )
                    throw new Error(
                      "Сначала завершите или архивируйте цели и удалите бюджеты в текущей валюте.",
                    );
                  return { ...s, profile };
                });
                setMessage("Настройки сохранены");
                setError("");
              } catch (e) {
                setError(
                  e instanceof Error && e.name !== "ZodError"
                    ? e.message
                    : "Проверьте суммы и часовой пояс.",
                );
              }
            }}
          >
            <Field label="Ваше имя">
              <input
                name="name"
                defaultValue={state.profile.name}
                required
                maxLength={60}
              />
            </Field>
            <div className="form-grid">
              <Field label="Основная валюта">
                <select name="currency" defaultValue={state.profile.currency}>
                  {["RUB", "USD", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Тема">
                <select name="theme" defaultValue={state.profile.theme}>
                  <option value="system">Как на устройстве</option>
                  <option value="light">Светлая</option>
                  <option value="dark">Тёмная</option>
                </select>
              </Field>
            </div>
            <p className="hint">
              Суммы не конвертируются автоматически. Основную валюту можно
              сменить, когда нет активных целей и бюджетов.
            </p>
            <Field label="Средний доход в месяц">
              <input
                name="income"
                inputMode="decimal"
                defaultValue={state.profile.monthlyIncomeMinor / 100}
              />
            </Field>
            <Field label="Обязательные расходы в месяц">
              <input
                name="mandatory"
                inputMode="decimal"
                defaultValue={state.profile.mandatoryMinor / 100}
              />
            </Field>
            <Field label="Подушка (число месяцев)">
              <input
                name="reserve"
                type="number"
                min="0"
                max="24"
                step="0.5"
                defaultValue={state.profile.reserveMonths}
              />
            </Field>
            <Field label="Часовой пояс">
              <input
                name="timezone"
                defaultValue={state.profile.timezone}
                required
              />
            </Field>
            <button className="btn-primary">Сохранить настройки</button>
          </form>
        </section>
        <div className="stack">
          <section className="card">
            <h2>
              <ShieldCheck size={20} />
              Данные под вашим контролем
            </h2>
            <p className="muted">
              Сейчас Копилка сохраняет информацию только в этом браузере.
              Синхронизация и вход в аккаунт появятся после подключения сервера.
              Регулярно скачивайте резервную копию.
            </p>
            <div className="stack">
              <button
                className="btn-secondary"
                onClick={() =>
                  download(
                    `kopilka-${state.mode}-backup.json`,
                    JSON.stringify(state, null, 2),
                  )
                }
              >
                <Download size={17} />
                Скачать резервную копию JSON
              </button>
              <button
                className="btn-secondary"
                onClick={() => upload.current?.click()}
              >
                <Upload size={17} />
                Восстановить из копии
              </button>
              <input
                ref={upload}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 10_000_000)
                      throw new Error("Файл слишком большой");
                    const data = validateState(
                      stateSchema.parse(JSON.parse(await file.text())),
                    );
                    setRestore(data);
                    setError("");
                  } catch {
                    setError(
                      "Некорректная резервная копия. Проверьте формат и связи операций со счетами.",
                    );
                  }
                  e.target.value = "";
                }}
              />
              <Link className="text-button" href="/transactions">
                Экспорт операций в CSV →
              </Link>
            </div>
          </section>
          <section className="card">
            <h2>
              <Smartphone size={20} />
              Копилка всегда рядом
            </h2>
            <p className="muted">
              На iPhone откройте приложение в Safari, нажмите «Поделиться» → «На
              экран Домой». На Android выберите «Установить приложение» в меню
              браузера.
            </p>
            <p className="hint">
              После первого посещения основные страницы доступны офлайн. Данные
              остаются на этом устройстве.
            </p>
          </section>
          <section className="card">
            <h2>Исследуйте возможности</h2>
            <p className="muted">
              Откройте отдельный демопример с шестью месяцами истории. Ваши
              личные данные сохранятся.
            </p>
            <button className="btn-secondary" onClick={demo}>
              Открыть демопример
            </button>
          </section>
        </div>
      </div>
      <section className="card categories-card">
        <div className="section-title">
          <h2>Категории</h2>
          <button className="btn-secondary" onClick={() => open("category")}>
            <Plus size={16} />
            Добавить
          </button>
        </div>
        <div className="categories-grid">
          {state.categories.map((c) => (
            <button
              key={c.id}
              className={c.archived ? "archived-category" : ""}
              aria-label={`${c.archived ? "Показать" : "Скрыть"} категорию ${c.name}`}
              onClick={() =>
                void update((s) => ({
                  ...s,
                  categories: s.categories.map((x) =>
                    x.id === c.id ? { ...x, archived: !x.archived } : x,
                  ),
                }))
              }
            >
              <span>
                <Glyph value={c.icon} size={16} />
              </span>
              {c.name}
              <small>
                {c.archived
                  ? "скрыта"
                  : c.kind === "income"
                    ? "доход"
                    : "расход"}
              </small>
            </button>
          ))}
        </div>
        <p className="hint">
          Нажмите на категорию, чтобы скрыть её в новых операциях или показать
          снова. История сохранится.
        </p>
      </section>
      <section className="card danger-zone">
        <h2>Удаление данных</h2>
        <p>
          Удалит личные и демонстрационные данные из этого браузера. Скачайте
          копию, если хотите сохранить историю.
        </p>
        <button className="btn-danger" onClick={() => setDeleting(true)}>
          Удалить данные на устройстве
        </button>
      </section>
      {deleting && (
        <Modal
          title="Удалить все локальные данные?"
          onClose={() => setDeleting(false)}
        >
          <form
            className="entry-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (new FormData(e.currentTarget).get("confirm") === "УДАЛИТЬ") {
                reset();
                setDeleting(false);
              }
            }}
          >
            <p>
              Это действие нельзя отменить. Серверный аккаунт не создавался.
            </p>
            <Field label="Введите УДАЛИТЬ для подтверждения">
              <input name="confirm" required pattern="УДАЛИТЬ" />
            </Field>
            <button className="btn-danger">Удалить навсегда</button>
          </form>
        </Modal>
      )}
      {restore && (
        <Modal title="Восстановить данные?" onClose={() => setRestore(null)}>
          <p>
            Текущий набор данных будет заменён: {restore.accounts.length}{" "}
            счетов, {restore.transactions.length} операций. Рекомендуем сначала
            скачать текущую копию.
          </p>
          <button
            className="btn-primary"
            onClick={async () => {
              try {
                await update(() => ({ ...restore, mode: state.mode }));
                setRestore(null);
                setMessage("Резервная копия восстановлена");
              } catch {
                setError("Не удалось восстановить копию");
              }
            }}
          >
            Заменить данные текущего режима
          </button>
        </Modal>
      )}
    </>
  );
}
export function Assistant() {
  return <DecisionAssistant />;
}
