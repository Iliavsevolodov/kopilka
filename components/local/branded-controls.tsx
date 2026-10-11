"use client";
import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";
import { useFinance } from "./provider";
import { dateSchema, today } from "@/lib/local/model";
export const FieldLabelContext = createContext<string | undefined>(undefined);
function subscribeViewport(fn: () => void) {
  window.visualViewport?.addEventListener("resize", fn);
  window.addEventListener("resize", fn);
  return () => {
    window.visualViewport?.removeEventListener("resize", fn);
    window.removeEventListener("resize", fn);
  };
}
function viewport() {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}
export function ControlPanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  const height = useSyncExternalStore(subscribeViewport, viewport, () => 800);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="control-panel"
      aria-labelledby={id}
      data-compact={height < 480}
      style={{ "--control-height": `${height}px` } as React.CSSProperties}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          className="control-close"
          type="button"
          aria-label="Закрыть выбор"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) =>
      typeof c === "string" || typeof c === "number"
        ? String(c)
        : isValidElement<{ children?: ReactNode }>(c)
          ? textOf(c.props.children)
          : "",
    )
    .join("");
}
function optionsOf(
  children: ReactNode,
): { value: string; label: string; disabled: boolean }[] {
  return Children.toArray(children).flatMap((c) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(c)
    )
      return [];
    if (c.type === Fragment) return optionsOf(c.props.children);
    return [
      {
        value: String(c.props.value ?? textOf(c.props.children)),
        label: textOf(c.props.children),
        disabled: !!c.props.disabled,
      },
    ];
  });
}
export function BrandSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldLabel = useContext(FieldLabelContext);
  const label =
    props["aria-label"] ?? fieldLabel ?? props.name ?? "Выберите значение";
  const options = optionsOf(props.children),
    [local, setLocal] = useState(
      String(props.defaultValue ?? options[0]?.value ?? ""),
    );
  const value = String(props.value ?? local),
    selected = options.find((o) => o.value === value),
    [open, setOpen] = useState(false),
    [invalid, setInvalid] = useState(false);
  const listId = useId(),
    trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function choose(next: string) {
    setLocal(next);
    setInvalid(false);
    props.onChange?.({
      target: { value: next, name: props.name ?? "" },
      currentTarget: { value: next, name: props.name ?? "" },
    } as ChangeEvent<HTMLSelectElement>);
    close();
  }
  return (
    <div className="brand-select" data-value={value}>
      <input type="hidden" name={props.name} value={selected?.value ?? ""} />
      {props.required && (
        <input
          className="control-validity"
          tabIndex={-1}
          aria-hidden="true"
          value={selected?.value ?? ""}
          required
          onChange={() => {}}
          onInvalid={(e) => {
            e.preventDefault();
            setInvalid(true);
            trigger.current?.focus();
          }}
        />
      )}
      <button
        ref={trigger}
        id={props.id}
        type="button"
        role="combobox"
        data-value={value}
        aria-label={label}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        disabled={props.disabled}
        className={`brand-select-trigger ${props.className ?? ""}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? "Выберите значение"}</span>
        <ChevronDown size={16} />
      </button>
      {invalid && (
        <span className="control-error" role="alert">
          Выберите значение
        </span>
      )}
      {open && (
        <SelectPanel
          title={label}
          options={options}
          selected={value}
          listId={listId}
          onSelect={choose}
          onClose={close}
        />
      )}
    </div>
  );
}
function SelectPanel({
  title,
  options,
  selected,
  listId,
  onSelect,
  onClose,
}: {
  title: string;
  options: ReturnType<typeof optionsOf>;
  selected: string;
  listId: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    height = useSyncExternalStore(subscribeViewport, viewport, () => 800),
    size = height < 480 ? 3 : 6;
  const filtered = options.filter((o) =>
      o.label.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
    ),
    pages = Math.max(1, Math.ceil(filtered.length / size)),
    current = Math.min(page, pages - 1),
    visible = filtered.slice(current * size, (current + 1) * size),
    list = useRef<HTMLDivElement>(null);
  function navigate(e: React.KeyboardEvent) {
    const buttons = [
        ...(list.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? []),
      ],
      index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? buttons.length - 1
            : Math.max(
                0,
                Math.min(
                  buttons.length - 1,
                  index + (e.key === "ArrowDown" ? 1 : -1),
                ),
              );
      buttons[next]?.focus();
    }
  }
  return (
    <ControlPanel title={title} onClose={onClose}>
      <div className="control-search">
        <Search size={17} />
        <input
          aria-label="Поиск вариантов"
          placeholder="Найти в списке"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              list.current
                ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
                ?.focus();
            }
          }}
        />
      </div>
      <div
        id={listId}
        ref={list}
        role="listbox"
        aria-label={title}
        onKeyDown={navigate}
        className="control-options"
      >
        {visible.map((o) => (
          <button
            type="button"
            role="option"
            aria-selected={o.value === selected}
            data-value={o.value}
            disabled={o.disabled}
            key={o.value}
            onClick={() => onSelect(o.value)}
          >
            <span>{o.label}</span>
            {o.value === selected && <Check size={18} />}
          </button>
        ))}
        {!visible.length && (
          <p className="muted">Совпадений нет. Измените запрос.</p>
        )}
      </div>
      <footer className="control-pagination">
        <button
          type="button"
          aria-label="Предыдущие варианты"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span aria-live="polite">
          {current + 1} / {pages} · {filtered.length} вариантов
        </span>
        <button
          type="button"
          aria-label="Следующие варианты"
          disabled={current === pages - 1}
          onClick={() => setPage(current + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </footer>
    </ControlPanel>
  );
}
function displayDate(value: string) {
  return dateSchema.safeParse(value).success
    ? value.split("-").reverse().join(".")
    : value;
}
function isoDate(value: string) {
  return /^\d{2}\.\d{2}\.\d{4}$/.test(value)
    ? value.split(".").reverse().join("-")
    : value;
}
export function BrandDate(props: InputHTMLAttributes<HTMLInputElement>) {
  const contextLabel = useContext(FieldLabelContext),
    label = props["aria-label"] ?? contextLabel ?? "Дата";
  const [local, setLocal] = useState(String(props.defaultValue ?? "")),
    value = String(props.value ?? local),
    [draft, setDraft] = useState<string | null>(null),
    [open, setOpen] = useState(false),
    [invalid, setInvalid] = useState("");
  const ref = useRef<HTMLInputElement>(null),
    button = useRef<HTMLButtonElement>(null),
    min = String(props.min ?? "0001-01-01"),
    max = String(props.max ?? "9999-12-31");
  function commit(next: string) {
    setLocal(next);
    setDraft(null);
    setInvalid("");
    if (ref.current) ref.current.setCustomValidity("");
    props.onChange?.({
      target: { value: next, name: props.name ?? "" },
      currentTarget: { value: next, name: props.name ?? "" },
    } as ChangeEvent<HTMLInputElement>);
  }
  function close() {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }
  return (
    <div className="brand-date">
      <input type="hidden" name={props.name} value={value} />
      <div className="brand-date-input">
        <input
          ref={ref}
          id={props.id}
          aria-label={label}
          aria-invalid={!!invalid || undefined}
          placeholder="ДД.ММ.ГГГГ"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={props.required}
          disabled={props.disabled}
          value={draft ?? displayDate(value)}
          onChange={(e) => {
            const raw = e.target.value,
              next = isoDate(raw);
            setDraft(raw);
            const error =
              next &&
              (!dateSchema.safeParse(next).success || next < min || next > max)
                ? "Введите допустимую дату в формате ДД.ММ.ГГГГ"
                : "";
            e.target.setCustomValidity(error);
            setInvalid(error);
            if (!error) commit(next);
          }}
          onInvalid={(e) => {
            e.preventDefault();
            setInvalid("Выберите допустимую дату");
          }}
        />
        <button
          ref={button}
          type="button"
          className="calendar-trigger"
          aria-label={`Открыть календарь: ${label}`}
          disabled={props.disabled}
          onClick={() => setOpen(true)}
        >
          <CalendarDays size={19} />
        </button>
      </div>
      {invalid && (
        <span role="alert" className="control-error">
          {invalid}
        </span>
      )}
      {open && (
        <DatePanel
          title={label}
          value={value}
          min={min}
          max={max}
          required={props.required}
          onClose={close}
          onSelect={(date) => {
            commit(date);
            close();
          }}
        />
      )}
    </div>
  );
}
function DatePanel({
  title,
  value,
  min,
  max,
  required,
  onSelect,
  onClose,
}: {
  title: string;
  value: string;
  min: string;
  max: string;
  required?: boolean;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const { state } = useFinance();
  const now = today(state.profile.timezone),
    initial = dateSchema.safeParse(value).success
      ? value
      : now < min
        ? min
        : now > max
          ? max
          : now;
  const [month, setMonth] = useState(initial.slice(0, 7) + "-01"),
    [mode, setMode] = useState<"days" | "months" | "years">("days"),
    [yearStart, setYearStart] = useState(
      Math.floor(Number(initial.slice(0, 4)) / 12) * 12,
    );
  const date = parseISO(month),
    year = date.getFullYear(),
    monthIndex = date.getMonth(),
    offset = (date.getDay() + 6) % 7,
    days = getDaysInMonth(date),
    grid = useRef<HTMLDivElement>(null);
  const shift = (by: number) =>
    setMonth(format(addMonths(date, by), "yyyy-MM-dd"));
  function keyboard(e: React.KeyboardEvent) {
    const items = [
        ...(grid.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? []),
      ],
      i = items.indexOf(document.activeElement as HTMLButtonElement),
      delta =
        e.key === "ArrowRight"
          ? 1
          : e.key === "ArrowLeft"
            ? -1
            : e.key === "ArrowDown"
              ? 7
              : e.key === "ArrowUp"
                ? -7
                : 0;
    if (delta) {
      e.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, i + delta))]?.focus();
    }
  }
  return (
    <ControlPanel title={title} onClose={onClose}>
      <div className="calendar-toolbar">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          disabled={
            mode === "days" &&
            format(addMonths(date, -1), "yyyy-MM") < min.slice(0, 7)
          }
          onClick={() =>
            mode === "years"
              ? setYearStart(Math.max(1, yearStart - 12))
              : shift(mode === "months" ? -12 : -1)
          }
        >
          <ChevronLeft size={19} />
        </button>
        <button
          type="button"
          className="calendar-heading"
          onClick={() =>
            setMode(
              mode === "days" ? "months" : mode === "months" ? "years" : "days",
            )
          }
        >
          {mode === "days"
            ? new Intl.DateTimeFormat("ru-RU", {
                month: "long",
                year: "numeric",
              }).format(date)
            : mode === "months"
              ? String(year)
              : `${yearStart}–${yearStart + 11}`}
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          aria-label="Следующий месяц"
          disabled={
            mode === "days" &&
            format(addMonths(date, 1), "yyyy-MM") > max.slice(0, 7)
          }
          onClick={() =>
            mode === "years"
              ? setYearStart(Math.min(9988, yearStart + 12))
              : shift(mode === "months" ? 12 : 1)
          }
        >
          <ChevronRight size={19} />
        </button>
      </div>
      {mode === "days" ? (
        <>
          <div className="calendar-weekdays">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            className="calendar-days"
            role="group"
            aria-label="Дни месяца"
            ref={grid}
            onKeyDown={keyboard}
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const iso = `${month.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button
                  type="button"
                  key={iso}
                  data-date={iso}
                  data-today={iso === now}
                  aria-label={new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(parseISO(iso))}
                  aria-pressed={value === iso}
                  disabled={iso < min || iso > max}
                  onClick={() => onSelect(iso)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="calendar-periods">
          {Array.from({ length: 12 }, (_, i) =>
            mode === "months" ? (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setMonth(`${year}-${String(i + 1).padStart(2, "0")}-01`);
                  setMode("days");
                }}
              >
                {new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(
                  new Date(2026, i, 1),
                )}
              </button>
            ) : (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setMonth(
                    `${String(yearStart + i).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-01`,
                  );
                  setMode("months");
                }}
              >
                {yearStart + i}
              </button>
            ),
          )}
        </div>
      )}
      <footer className="calendar-footer">
        {!required && (
          <button type="button" onClick={() => onSelect("")}>
            Очистить
          </button>
        )}
        <button
          type="button"
          disabled={now < min || now > max}
          onClick={() => onSelect(now)}
        >
          Сегодня
        </button>
        <button type="button" onClick={onClose}>
          Отмена
        </button>
      </footer>
    </ControlPanel>
  );
}
export function BrandColor({
  name,
  defaultValue = "#19765f",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const colors = [
    "#19765f",
    "#4b9171",
    "#397ba4",
    "#5961a8",
    "#9066a8",
    "#b2648a",
    "#bd6b42",
    "#b79a51",
  ];
  return (
    <div className="brand-colors">
      <input type="hidden" name={name} value={value} />
      {colors.map((c, i) => (
        <button
          type="button"
          key={c}
          aria-label={`Цвет: ${["Изумрудный", "Шалфейный", "Синий", "Индиго", "Фиолетовый", "Розовый", "Терракотовый", "Песочный"][i]}`}
          aria-pressed={value === c}
          style={{ background: c }}
          onClick={() => setValue(c)}
        >
          {value === c && <Check size={18} />}
        </button>
      ))}
    </div>
  );
}

export function BrandFile(props: InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null),
    [filename, setFilename] = useState("Файл ещё не выбран");
  const label = props["aria-label"] ?? "Файл CSV";
  return (
    <div className="brand-file">
      <input
        {...props}
        ref={ref}
        type="file"
        hidden
        aria-label={label}
        onChange={(e) => {
          setFilename(e.target.files?.[0]?.name ?? "Файл ещё не выбран");
          props.onChange?.(e);
        }}
      />
      <button
        type="button"
        className="btn-secondary"
        aria-label={`Выбрать ${label}`}
        onClick={() => ref.current?.click()}
      >
        Выбрать файл
      </button>
      <span>{filename}</span>
    </div>
  );
}
