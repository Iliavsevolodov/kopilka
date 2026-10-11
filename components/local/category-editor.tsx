"use client";
import { useState } from "react";
import { categorySchema } from "@/lib/local/model";
import { useFinance } from "./provider";
import { Field, Modal } from "./ui";
import { IconPicker } from "./icon-picker";

export function CategoryEditor({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { state, update } = useFinance();
  const category = state.categories.find((c) => c.id === id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!category) return null;
  return (
    <Modal title="Изменить категорию" onClose={onClose}>
      <form
        className="entry-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setSaving(true);
          try {
            const changes = categorySchema.parse({
              ...category,
              name: String(data.get("name")),
              icon: String(data.get("icon")),
              archived: data.get("archived") === "on",
            });
            await update((s) => ({
              ...s,
              categories: s.categories.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      name: changes.name,
                      icon: changes.icon,
                      archived: changes.archived,
                    }
                  : c,
              ),
            }));
            onClose();
          } catch {
            setError(
              "Не удалось сохранить категорию. Проверьте название и попробуйте снова.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Название категории">
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={category.name}
          />
        </Field>
        <IconPicker initialValue={category.icon} />
        <label className="check">
          <input
            type="checkbox"
            name="archived"
            defaultChecked={category.archived}
          />
          Скрыть в новых операциях
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
