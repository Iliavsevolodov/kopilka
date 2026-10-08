"use client";
import { SheetForm } from "./sheet-form";
import { useFinance } from "./provider";
import { formatMoney } from "@/lib/finance/money";
import { ArrowUpRight, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ReactElement,
  type FormHTMLAttributes,
} from "react";
export function Money({
  value,
  currency,
  approx = false,
}: {
  value: number;
  currency?: string;
  approx?: boolean;
}) {
  const { state } = useFinance();
  return (
    <>
      {state.profile.hidden
        ? "••••••"
        : `${approx ? "≈ " : ""}${formatMoney(approx ? Math.round(value / 100000) * 100000 : value, currency ?? state.profile.currency)}`}
    </>
  );
}
export function SectionTitle({
  title,
  href,
  label = "Все",
}: {
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {href && (
        <Link href={href}>
          {label}
          <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ArrowUpRight />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Прогресс"
      aria-valuenow={Math.round(Math.min(1, Math.max(0, value)) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          background: color,
        }}
      />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const scrollY = window.scrollY;
    const previous = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    const resize = () => {
      const viewport = window.visualViewport;
      if (dialog)
        dialog.dataset.compact = String(
          (viewport?.height ?? window.innerHeight) < 560,
        );
      dialog?.style.setProperty(
        "--sheet-viewport",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog?.style.setProperty(
        "--sheet-bottom",
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    dialog?.showModal();
    return () => {
      dialog?.close();
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      Object.assign(document.body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {Children.map(children, (child) =>
        isValidElement(child) && child.type === "form" ? (
          <SheetForm
            form={child as ReactElement<FormHTMLAttributes<HTMLFormElement>>}
          />
        ) : (
          child
        ),
      )}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
