import { expect, test } from "@playwright/test";

test("Product A embeds the assistant with its current governed table", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据质量运营台" })).toBeVisible();
  await expect(page.getByText("AURORA CONTROL")).toBeVisible();
  await expect(page.getByText("订单明细表").first()).toBeVisible();
  const assistant = page.frameLocator('iframe[title="企业业务智能助手"]');
  await expect(assistant.getByRole("heading", { name: "业务智能助手" })).toBeVisible();

  const input = assistant.getByPlaceholder(/询问.*订单明细表/);
  await input.fill("当前数据质量怎么样？");
  await input.press("Enter");
  await expect(
    assistant.getByText(/Product A 数据治理平台中的订单数据当前质量得分为 96%/),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(assistant.getByText("可信依据")).toBeVisible();
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({ path: "../../docs/demo-product-a.png", fullPage: true });
});

test("Product A updates assistant context when the host page changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /客户主数据表/ }).click();
  await expect(page.getByText("/governance/tables/customers")).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="企业业务智能助手"]').getByPlaceholder(/询问.*客户主数据表/),
  ).toBeVisible();
});
