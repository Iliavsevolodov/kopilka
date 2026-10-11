import type { Locator, Page } from "@playwright/test";
export async function pick(
  page: Page,
  trigger: Locator,
  value: string | { label: string },
) {
  const names: Record<string, string> = {
    savings: "Накопительный",
    dark: "Тёмная",
    "cat-0": "Продукты",
    "cat-2": "Дом",
  };
  const label =
    typeof value === "string" ? (names[value] ?? value) : value.label;
  await trigger.click();
  const panel = page.getByRole("dialog").last();
  await panel.getByRole("textbox", { name: "Поиск вариантов" }).fill(label);
  // Refund options additionally include their remaining amount.
  const option = panel.getByRole("option").filter({ hasText: label });
  await option.first().click();
}
