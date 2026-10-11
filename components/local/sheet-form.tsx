"use client";
import {
  Children,
  Fragment,
  isValidElement,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type FormHTMLAttributes,
} from "react";
function subscribe(callback: () => void) {
  window.addEventListener("resize", callback);
  window.visualViewport?.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("resize", callback);
    window.visualViewport?.removeEventListener("resize", callback);
  };
}
function viewport() {
  return `${window.innerWidth}:${Math.round(window.visualViewport?.height ?? window.innerHeight)}`;
}
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children)
    .filter((child) => typeof child !== "string" || child.trim().length > 0)
    .flatMap((child) =>
      isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
        ? flatten(child.props.children)
        : [child],
    );
}
type FormProps = FormHTMLAttributes<HTMLFormElement>;
/** Keep every field mounted so navigating a sheet never loses entered values. */
export function SheetForm({ form }: { form: ReactElement<FormProps> }) {
  const size = useSyncExternalStore(subscribe, viewport, () => "1024:900");
  const [width, height] = size.split(":").map(Number);
  const mobile = width < 768;
  const count = height < 560 ? 1 : 3;
  const [anchor, setAnchor] = useState(0);
  const [validationError, setValidationError] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const children = flatten(form.props.children);
  const fields: ReactNode[] = [],
    actions: ReactNode[] = [],
    messages: ReactNode[] = [];
  for (const child of children) {
    if (isValidElement<{ className?: string; role?: string }>(child)) {
      const cls = child.props.className ?? "";
      if (mobile && cls.includes("favorite-categories")) continue;
      if (child.props.role === "alert") {
        messages.push(child);
        continue;
      }
      if (child.type === "button" || cls.includes("button-row")) {
        actions.push(child);
        continue;
      }
    }
    fields.push(child);
  }
  const pages = Math.max(1, Math.ceil(fields.length / count));
  const page = Math.min(pages - 1, Math.floor(anchor / count));
  function move(direction: number) {
    const visible = ref.current?.querySelectorAll<HTMLElement>(
      "[data-sheet-index]:not([hidden]) input, [data-sheet-index]:not([hidden]) select, [data-sheet-index]:not([hidden]) textarea",
    );
    if (direction > 0 && visible)
      for (const field of visible) {
        const input = field as HTMLInputElement;
        if (!input.checkValidity()) {
          setValidationError(input.validationMessage);
          return;
        }
      }
    (document.activeElement as HTMLElement)?.blur();
    setAnchor((page + direction) * count);
  }
  if (!mobile) return form;
  return (
    <form
      {...form.props}
      ref={ref}
      className={`${form.props.className ?? ""} sheet-form`}
      onChangeCapture={() => setValidationError("")}
      onFocusCapture={(event) => {
        const item = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-sheet-index]",
        );
        if (item) setAnchor(Number(item.dataset.sheetIndex));
      }}
      onInvalidCapture={(event) => {
        event.preventDefault();
        const input = event.target as HTMLInputElement;
        const item = input.closest<HTMLElement>("[data-sheet-index]");
        if (item) {
          setAnchor(Number(item.dataset.sheetIndex));
          requestAnimationFrame(() => {
            input.focus();
            setValidationError(input.validationMessage);
          });
        }
      }}
    >
      <>
        {pages > 1 && (
          <div
            className="sheet-progress"
            aria-label={`Шаг ${page + 1} из ${pages}`}
          >
            <span>
              Шаг {page + 1} из {pages}
            </span>
            <div>
              {Array.from({ length: pages }, (_, i) => (
                <i key={i} className={i === page ? "active" : ""} />
              ))}
            </div>
          </div>
        )}
        <div className="sheet-fields">
          {fields.map((field, i) => (
            <div
              key={isValidElement(field) ? (field.key ?? i) : i}
              data-sheet-index={i}
              hidden={Math.floor(i / count) !== page}
            >
              {field}
            </div>
          ))}
        </div>
        <div className="sheet-footer">
          {validationError && (
            <p className="error-message" role="alert">
              {validationError}
            </p>
          )}
          {messages}
          {pages > 1 && (
            <div className="sheet-navigation">
              <button
                type="button"
                className="text-button"
                disabled={page === 0}
                onClick={() => move(-1)}
              >
                Назад
              </button>
              <button
                type="button"
                className="text-button"
                disabled={page === pages - 1}
                onClick={() => move(1)}
              >
                Далее
              </button>
            </div>
          )}
          {actions}
        </div>
      </>
    </form>
  );
}
