"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { ConnectionStatus } from "./connection-status";
import { usePathname } from "next/navigation";
import {
  House,
  ArrowLeftRight,
  ChartNoAxesCombined,
  CalendarDays,
  CircleUserRound,
  Plus,
  Sprout,
  Wallet,
  Target,
  Sparkles,
  Search,
  ArrowUpRight,
  FlaskConical,
  Download,
} from "lucide-react";
import { LocalProvider, useFinance } from "./provider";
import { Onboarding } from "./onboarding";
import { EntryForm, type FormKind } from "./forms";
import { download } from "./ui";
const nav = [
  { href: "/dashboard", label: "Главная", icon: House },
  { href: "/transactions", label: "Операции", icon: ArrowLeftRight },
  { href: "/accounts", label: "Мои счета", icon: Wallet },
  { href: "/analytics", label: "Аналитика", icon: ChartNoAxesCombined },
  { href: "/plan", label: "План и прогноз", icon: CalendarDays },
  { href: "/goals", label: "Финансовые цели", icon: Target },
];
const FormContext = createContext<(kind: FormKind) => void>(() => {});
export const useEntry = () => useContext(FormContext);
export function Workspace({ children }: { children: ReactNode }) {
  return (
    <LocalProvider>
      <Shell>{children}</Shell>
    </LocalProvider>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const { state, ready, error, personal } = useFinance(),
    path = usePathname().replace(/\/$/, "") || "/";
  const [form, setForm] = useState<FormKind | null>(null);
  if (!ready)
    return (
      <main className="loading-page" aria-label="Загрузка">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </main>
    );
  if (error)
    return (
      <main className="onboarding">
        <h1>Данные требуют восстановления</h1>
        <p role="alert">{error}</p>
        <button
          className="btn-primary"
          onClick={() =>
            download(
              "kopilka-recovery.json",
              JSON.stringify({ ...localStorage }),
            )
          }
        >
          <Download size={18} />
          Скачать исходные данные
        </button>
      </main>
    );
  if (!state.profile.onboarded) return <Onboarding />;
  return (
    <FormContext.Provider value={setForm}>
      <div className="app-layout">
        <aside className="sidebar">
          <Link className="brand" href="/dashboard">
            <span className="brand-icon">
              <Sprout size={25} />
            </span>
            KOPILKA<span className="brand-dot">.</span>
          </Link>
          <span className="sidebar-caption">ЛИЧНЫЕ ФИНАНСЫ</span>
          <nav aria-label="Основная навигация">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={path === href ? "active" : ""}
              >
                <Icon size={19} />
                {label}
                {path === href && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-divider" />
          <Link className="ai-link" href="/assistant">
            <Sparkles size={19} />
            Помощник<span>LOCAL</span>
          </Link>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <span className="plant">✳</span>
              <strong>
                Маленькие шаги.
                <br />
                Большое будущее.
              </strong>
              <p>Пусть ваши деньги работают на ваши планы.</p>
              <Link href="/goals">
                К моим целям <ArrowUpRight size={15} />
              </Link>
            </div>
            <Link className="profile-link" href="/profile">
              <span className="avatar">
                {state.profile.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{state.profile.name}</strong>
                <small>Личный профиль</small>
              </div>
              <CircleUserRound size={18} />
            </Link>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <Link
              href="/dashboard"
              className="mobile-wordmark"
              aria-label="KOPILKA — главная"
            >
              <Sprout size={21} />
              kopilka<span>®</span>
            </Link>
            <span className="breadcrumb">
              Моя Копилка <span>/</span>{" "}
              <strong>
                {nav.find((n) => n.href === path)?.label ??
                  (path === "/assistant" ? "Помощник" : "Профиль")}
              </strong>
            </span>
            <Link href="/transactions" className="top-search">
              <Search size={16} />
              Поиск операций
            </Link>
            <span className="local-badge">
              <span className="status-dot" />
              {state.mode === "demo" ? "Демопример" : "На этом устройстве"}
            </span>
            <Link
              href="/profile"
              className="avatar small-avatar"
              aria-label="Открыть профиль"
            >
              {state.profile.name.charAt(0).toUpperCase()}
            </Link>
          </header>
          {state.mode === "demo" && (
            <div className="demo-banner">
              <span>
                <FlaskConical size={15} />
                Деморежим · вымышленные данные
              </span>
              <button onClick={personal}>
                Мои финансы <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          <ConnectionStatus />
          <main className="page-content">{children}</main>
        </div>
        <nav className="mobile-nav" aria-label="Нижняя навигация">
          <Link
            href="/dashboard"
            className={path === "/dashboard" ? "active" : ""}
          >
            <House />
            Главная
          </Link>
          <Link
            href="/transactions"
            className={path === "/transactions" ? "active" : ""}
          >
            <ArrowLeftRight />
            Операции
          </Link>
          <button
            className="mobile-plus"
            aria-label="Добавить расход"
            onClick={() => setForm("expense")}
          >
            <span>
              <Plus />
            </span>
            Добавить
          </button>
          <Link href="/plan" className={path === "/plan" ? "active" : ""}>
            <CalendarDays />
            План
          </Link>
          <Link href="/profile" className={path === "/profile" ? "active" : ""}>
            <CircleUserRound />
            Профиль
          </Link>
        </nav>
        {form && <EntryForm kind={form} onClose={() => setForm(null)} />}
      </div>
    </FormContext.Provider>
  );
}
