import { test, expect, type Page } from "@playwright/test";
async function onboard(page: Page) {
  await page.goto("/dashboard");
  await page.getByLabel("Ваше имя").fill("Тест");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByLabel("Сколько денег на основной карте?").fill("100000");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Открыть мою Копилку" }).click();
  await expect(page.locator(".hero-amount")).toContainText("100");
}
async function state(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("kopilka.personal.v1")!),
  );
}
async function demo(page: Page) {
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Сначала посмотреть демопример" })
    .click();
  await expect(page.locator(".hero-amount")).toContainText("442");
}
test("onboarding, accounts, expense, transfer, income, goal, budget and recurring payment persist", async ({
  page,
}) => {
  await onboard(page);
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("10000");
  await dialog.getByLabel("Комментарий").fill("Проверка расхода");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".hero-amount")).toContainText("90");
  await page.goto("/accounts");
  await page
    .getByRole("button", { name: "Добавить счёт", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название", { exact: true }).fill("Накопительный");
  await dialog.getByLabel("Сумма", { exact: true }).fill("0");
  await dialog.getByLabel("Тип счёта").selectOption("savings");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Накопительный", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Перевести между счетами" })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("20000");
  await dialog
    .getByRole("combobox", { name: "На счёт", exact: true })
    .selectOption({ label: "Накопительный · RUB" });
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page.locator(".hero-amount")).toContainText("90");
  expect((await state(page)).transactions).toHaveLength(2);
  await page.getByRole("button", { name: "Доход", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("15000");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".hero-amount")).toContainText("105");
  await page.reload();
  await expect(page.locator(".hero-amount")).toContainText("105");
  await page.goto("/goals");
  await page.getByRole("button", { name: "Новая цель", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название", { exact: true }).fill("Отпуск");
  await dialog.getByLabel("Сумма", { exact: true }).fill("500000");
  await dialog.getByLabel("Уже выделено на цель").fill("10000");
  await dialog.getByLabel("К какой дате").fill("2027-08-08");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Отпуск", exact: true }),
  ).toBeVisible();
  await page.goto("/plan");
  await page.getByRole("button", { name: "Создать бюджет" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("20000");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".budget-item")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Регулярный платёж", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название", { exact: true }).fill("Интернет");
  await dialog.getByLabel("Сумма", { exact: true }).fill("1000");
  const today = await dialog.getByLabel("Начало расписания").inputValue();
  await dialog
    .getByLabel("День каждого месяца")
    .fill(String(Number(today.slice(8))));
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect((await state(page)).transactions).toHaveLength(3);
  await page.getByRole("button", { name: "Оплачено", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Оплачено", exact: true }),
  ).toHaveCount(0);
  expect((await state(page)).transactions).toHaveLength(4);
  await page.goto("/dashboard");
  await expect(page.locator(".hero-amount")).toContainText("104");
});
test("demo isolation, backup and explicit deletion confirmation", async ({
  page,
}) => {
  await onboard(page);
  await page.goto("/profile");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать резервную копию JSON" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "kopilka-personal-backup.json",
  );
  await page
    .getByRole("button", { name: "Открыть демопример", exact: true })
    .click();
  await page.goto("/dashboard");
  await expect(page.locator(".hero-amount")).toContainText("442");
  await page.getByRole("button", { name: "Мои финансы", exact: true }).click();
  await expect(page.locator(".hero-amount")).toContainText("100");
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Удалить данные на устройстве" })
    .click();
  await page.getByLabel("Введите УДАЛИТЬ для подтверждения").fill("УДАЛИТЬ");
  await page.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect(
    page.getByRole("heading", { name: "Давайте познакомимся" }),
  ).toBeVisible();
});
test("all screens responsive with no horizontal scrolling", async ({
  page,
}) => {
  test.setTimeout(120000);
  await demo(page);
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "dashboard",
      "accounts",
      "transactions",
      "plan",
      "goals",
      "analytics",
      "profile",
      "assistant",
    ]) {
      await page.goto("/" + route);
      await expect(page.locator(".page-content")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
});
test("dark mode, hidden balances and valid PWA manifest", async ({ page }) => {
  await demo(page);
  await page.goto("/profile");
  await page
    .getByRole("combobox", { name: "Тема", exact: true })
    .selectOption("dark");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Скрыть суммы" }).click();
  await expect(page.locator(".hero-amount")).toHaveText("••••••");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(
    manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512"),
  ).toBe(true);
  for (const i of manifest.icons)
    expect((await page.request.get(i.src)).ok()).toBe(true);
});
test("installed shell reloads offline and stores a new expense", async ({
  page,
  context,
}) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator(".hero-amount")).toContainText("100");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".hero-amount")).toContainText("100");
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Сумма", { exact: true })
    .fill("500");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).transactions[0].amountMinor).toBe(50000);
  await context.setOffline(false);
});

test("editing changes balance once and keeps the same transaction", async ({
  page,
}) => {
  await onboard(page);
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("10000");
  await dialog.getByLabel("Комментарий").fill("Проверка редактирования");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator(".hero-amount")).toContainText("90");
  await page.goto("/transactions");
  await page
    .getByRole("button", {
      name: "Редактировать Проверка редактирования",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel("Сумма", { exact: true })).toHaveValue(
    "10000",
  );
  await dialog.getByLabel("Сумма", { exact: true }).fill("2500");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const data = await state(page);
  expect(data.transactions).toHaveLength(1);
  expect(data.transactions[0].amountMinor).toBe(250000);
  expect(data.transactions[0].updatedAt).toBeTruthy();
  await page.goto("/dashboard");
  await expect(page.locator(".hero-amount")).toContainText("97");
});
test("scenario and local assistant work without modifying recorded finances", async ({
  page,
}) => {
  await demo(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("kopilka.demo.v1"),
  );
  await page.goto("/plan");
  const scenario = page.locator(".what-if");
  await scenario.getByLabel("Изменение дохода в месяц").fill("20000");
  await expect(scenario.locator(".scenario-result")).toContainText("Разница");
  await scenario.getByLabel("Разовая покупка сейчас").fill("-1");
  await expect(scenario.getByRole("alert")).toBeVisible();
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Что будет через месяц?" }).click();
  await expect(page.locator(".advisor-answer")).toContainText(
    "Ожидаемый ликвидный остаток",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kopilka.demo.v1")),
  ).toBe(before);
});

test("mobile entry sheets fit without scrolling and retain values between steps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboard(page);
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".sheet-form")).toBeVisible();
  await dialog.getByLabel("Сумма", { exact: true }).fill("321");
  await dialog.getByRole("button", { name: "Далее", exact: true }).click();
  await dialog.getByLabel("Комментарий").fill("Проверка шторки");
  await dialog.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(dialog.getByLabel("Сумма", { exact: true })).toHaveValue("321");
  for (const height of [667, 420, 844]) {
    await page.setViewportSize({ width: 390, height });
    await expect
      .poll(() => dialog.evaluate((e) => e.scrollHeight <= e.clientHeight + 1))
      .toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Сохранить", exact: true }),
    ).toBeInViewport();
  }
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await state(page)).transactions[0].description).toBe(
    "Проверка шторки",
  );
  expect((await state(page)).transactions[0].amountMinor).toBe(32100);
  await expect
    .poll(() => page.evaluate(() => document.body.style.position))
    .toBe("");
});
