import { test, expect } from "@playwright/test";

test("branded pickers fit mobile sheets, support keyboard and retain dates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Сначала посмотреть демопример" })
    .click();
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  const sheet = page.getByRole("dialog").first();
  await sheet.getByLabel("Сумма", { exact: true }).fill("123");
  await sheet.getByLabel("Категория", { exact: true }).click();
  const picker = page.locator(".control-panel");
  await expect(picker.getByRole("listbox")).toBeVisible();
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 350 });
    await expect
      .poll(() => picker.evaluate((e) => e.scrollHeight <= e.clientHeight + 1))
      .toBe(true);
    await expect(
      picker.getByRole("button", { name: "Следующие варианты" }),
    ).toBeInViewport();
  }
  await picker
    .getByRole("textbox", { name: "Поиск вариантов" })
    .fill("Продукты");
  await picker
    .getByRole("textbox", { name: "Поиск вариантов" })
    .press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(picker).toHaveCount(0);
  await sheet.getByLabel("Категория", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await sheet.getByRole("button", { name: "Далее", exact: true }).click();
  await sheet.getByRole("button", { name: /Открыть календарь/ }).click();
  for (const height of [844, 350]) {
    await page.setViewportSize({ width: 390, height });
    await expect
      .poll(() => picker.evaluate((e) => e.scrollHeight <= e.clientHeight + 1))
      .toBe(true);
    await expect(
      picker.getByRole("button", { name: "Сегодня", exact: true }),
    ).toBeInViewport();
  }
  const date = picker.locator(".calendar-days button:not(:disabled)").first();
  const iso = await date.getAttribute("data-date");
  await date.click();
  await expect(picker).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await sheet.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kopilka.demo.v1")!),
  );
  expect(
    saved.transactions.find(
      (t: { amountMinor: number }) => t.amountMinor === 12300,
    ).date,
  ).toBe(iso);
  for (const route of [
    "transactions",
    "plan",
    "profile",
    "analytics",
    "accounts",
  ]) {
    await page.goto("/" + route);
    await expect(
      page.locator("select, input[type=date], input[type=color]"),
    ).toHaveCount(0);
  }
});
