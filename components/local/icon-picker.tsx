"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ICON_LIBRARY, normalizeIconId } from "@/lib/domain/icons";
import { Glyph } from "./glyph";

/** Paged rather than scrollable: fits the smallest mobile sheet above a keyboard. */
export function IconPicker({
  initialValue = "basket",
}: {
  initialValue?: string;
}) {
  const [value, setValue] = useState(normalizeIconId(initialValue));
  const [page, setPage] = useState(
    Math.floor(ICON_LIBRARY.findIndex((i) => i.id === value) / 8),
  );
  const selected = ICON_LIBRARY.find((i) => i.id === value)!;
  return (
    <fieldset className="icon-picker">
      <legend>Иконка · {selected.label}</legend>
      <input type="hidden" name="icon" value={value} />
      <div className="icon-library" role="group" aria-label="Библиотека иконок">
        {ICON_LIBRARY.slice(page * 8, page * 8 + 8).map((icon) => (
          <button
            type="button"
            key={icon.id}
            title={icon.label}
            aria-label={`Иконка: ${icon.label}`}
            aria-pressed={value === icon.id}
            onClick={() => setValue(icon.id)}
          >
            <Glyph value={icon.id} size={22} />
          </button>
        ))}
      </div>
      <div className="icon-pagination">
        <button
          type="button"
          aria-label="Предыдущие иконки"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span aria-live="polite">
          {page + 1} / {Math.ceil(ICON_LIBRARY.length / 8)} · 32 иконки
        </span>
        <button
          type="button"
          aria-label="Следующие иконки"
          disabled={(page + 1) * 8 >= ICON_LIBRARY.length}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </fieldset>
  );
}
