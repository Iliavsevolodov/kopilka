import { test, expect } from "@playwright/test";
import { pick } from "./control-helpers";
test("notification center is persistent, actionable, configurable and honest about push", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Сначала посмотреть демопример" })
    .click();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kopilka.demo.v1")!).transactions,
  );
  await page.getByRole("link", { name: /^Уведомления/ }).click();
  await expect(
    page.getByRole("heading", { name: "Уведомления", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notice-item").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Прочитать все", exact: true })
    .click();
  await expect(page.locator(".notice-item")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".notice-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Активные", exact: true }).click();
  await expect(page.locator(".notice-item").first()).toBeVisible();
  const first = await page.locator(".notice-item h2").first().textContent();
  await page
    .locator(".notice-item")
    .first()
    .getByRole("button", { name: "До завтра" })
    .click();
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(
    page.locator(".notice-item").filter({ hasText: first! }),
  ).toContainText("Отложено до завтра");
  await page.getByRole("button", { name: "Настройки уведомлений" }).click();
  await expect(page.locator(".push-settings")).toContainText(
    "Фоновая push-доставка пока не подключена",
  );
  await expect(
    page.getByRole("button", { name: "Включить push-доставку", exact: true }),
  ).toHaveCount(0);
  await pick(
    page,
    page.getByRole("combobox", { name: "Время напоминания", exact: true }),
    { label: "11:00" },
  );
  await page
    .getByLabel("Напоминание о ведении финансов", { exact: true })
    .click();
  await expect(
    page.getByLabel("Напоминание о ведении финансов", { exact: true }),
  ).toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: "Настройки уведомлений" }).click();
  await expect(
    page.getByLabel("Напоминание о ведении финансов", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Время напоминания", exact: true }),
  ).toHaveAttribute("data-value", "11");
  await page.getByLabel("Включить уведомления", { exact: true }).click();
  await expect(
    page.getByLabel("Включить уведомления", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Активные", exact: true }).click();
  await expect(page.locator(".notice-item")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kopilka.demo.v1")!).transactions,
    ),
  ).toEqual(before);
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      JSON.stringify(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
            }))
            .slice(0, 10),
        ),
      ),
    ).toBe(true);
  }
});
