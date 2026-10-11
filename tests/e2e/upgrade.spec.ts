import { pick } from "./control-helpers";
import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.goto("/dashboard");
  await page.getByLabel("Ваше имя", { exact: true }).fill("Тест");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByLabel("Сколько денег на основной карте?", { exact: true })
    .fill("100000");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Открыть мою Копилку" }).click();
}
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("kopilka.personal.v1")!));
test("split, refund and tags affect reporting exactly once and persist", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("10000");
  await dialog.getByLabel("Комментарий", { exact: true }).fill("Чек для дома");
  await dialog
    .getByLabel("Магазин / получатель", { exact: true })
    .fill("Магазин");
  await dialog
    .getByLabel("Теги через запятую", { exact: true })
    .fill("Ремонт, Дом");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/transactions");
  await page
    .getByRole("button", { name: "Действия с покупкой Чек для дома" })
    .click();
  await page.getByRole("button", { name: "Разделить по категориям" }).click();
  await pick(
    page,
    dialog.getByLabel("Категория части 1", { exact: true }),
    "cat-0",
  );
  await dialog.getByLabel("Сумма части 1", { exact: true }).fill("7000");
  await pick(
    page,
    dialog.getByLabel("Категория части 2", { exact: true }),
    "cat-2",
  );
  await dialog.getByLabel("Сумма части 2", { exact: true }).fill("3000");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await saved(page)).transactions).toHaveLength(1);
  await page
    .getByRole("button", { name: "Действия с покупкой Чек для дома" })
    .click();
  await page.getByRole("button", { name: "Оформить возврат" }).click();
  await pick(
    page,
    dialog.getByLabel("Категория возврата", { exact: true }),
    "cat-2",
  );
  await dialog.getByLabel("Сумма возврата", { exact: true }).fill("1000");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page.locator(".hero-amount")).toContainText("91");
  await page.goto("/analytics");
  await pick(page, page.getByLabel("Тег", { exact: true }), "Ремонт");
  await pick(page, page.getByLabel("Категория", { exact: true }), "cat-2");
  await expect(page.locator(".analytics-stats")).toContainText("2");
  await expect(page.locator(".category-detail")).toContainText("Магазин");
  await page.getByRole("link", { name: "Все операции категории" }).click();
  await expect(page.getByLabel("Категория", { exact: true })).toHaveAttribute(
    "data-value",
    "cat-2",
  );
  await expect(page.locator(".list-summary")).toContainText("2");
  await page.reload();
  expect((await saved(page)).transactions).toHaveLength(2);
});
test("CSV preview leaves balance untouched and repeat import excludes duplicates", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Импорт CSV", exact: true }).click();
  const file = {
    name: "bank.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Дата;Сумма;Тип;Категория;Описание;Магазин;Теги;ID\n2026-01-01;-1234,56;расход;Продукты;Кофе;Лавка;Дом;id-1\n2026-02-31;-100;расход;Продукты;Ошибка;;;id-2",
    ),
  };
  await page.getByLabel("Файл CSV", { exact: true }).setInputFiles(file);
  await expect(
    page.getByRole("button", { name: "Подтвердить импорт (1)" }),
  ).toBeEnabled();
  expect((await saved(page)).transactions).toHaveLength(0);
  await page.getByRole("button", { name: "Подтвердить импорт (1)" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Импортировано операций: 1",
  );
  expect((await saved(page)).transactions[0].amountMinor).toBe(123456);
  await page.getByLabel("Файл CSV", { exact: true }).setInputFiles(file);
  await expect(
    page.getByRole("button", { name: "Подтвердить импорт (0)" }),
  ).toBeDisabled();
  expect((await saved(page)).transactions).toHaveLength(1);
});
test("new screens and purchase sheets fit mobile and compact viewports", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Сумма", { exact: true })
    .fill("1000");
  await page
    .getByRole("dialog")
    .getByLabel("Комментарий", { exact: true })
    .fill("Покупка");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/analytics", "/plan", "/profile", "/transactions"]) {
      await page.goto(route);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 350 });
  await page.goto("/transactions");
  await page
    .getByRole("button", { name: "Действия с покупкой Покупка" })
    .click();
  await page.getByRole("button", { name: "Разделить по категориям" }).click();
  const dialog = page.getByRole("dialog");
  await expect
    .poll(() => dialog.evaluate((e) => e.scrollHeight <= e.clientHeight + 1))
    .toBe(true);
  await dialog.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(
    dialog.getByLabel("Категория части 1", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => dialog.evaluate((e) => e.scrollHeight <= e.clientHeight + 1))
    .toBe(true);
});

test("attention proposes a template, creates only a plan and can restore dismissed suggestions", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const key = "kopilka.personal.v1",
      s = JSON.parse(localStorage.getItem(key)!);
    s.transactions = ["2026-08-05", "2026-09-05", "2026-10-05"].map(
      (date, i) => ({
        id: "sub-" + i,
        type: "expense",
        date,
        accountId: s.accounts[0].id,
        categoryId: "cat-11",
        amountMinor: 99000,
        description: "Подписка на сервис",
        mandatory: false,
        impulsive: false,
        source: "manual",
        createdAt: new Date().toISOString(),
      }),
    );
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.goto("/profile");
  await page.getByRole("button", { name: "Проверить шаблон" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Создать шаблон" }).click();
  await expect(dialog).toHaveCount(0);
  const s = await saved(page);
  expect(s.recurring).toHaveLength(1);
  expect(s.transactions).toHaveLength(3);
  await expect(
    page.getByRole("button", { name: "Проверить шаблон" }),
  ).toHaveCount(0);
  await page.goto("/plan");
  await expect(page.locator("#safe-to-spend")).toContainText(
    "Будущие поступления не включены",
  );
});
