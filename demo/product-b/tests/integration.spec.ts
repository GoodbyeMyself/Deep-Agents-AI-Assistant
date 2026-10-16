import { expect, test } from "@playwright/test";

test("Product B embeds the same assistant contract over its own adapter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据资产驾驶舱" })).toBeVisible();
  await expect(page.getByText("NORTHSTAR OPS")).toBeVisible();
  await expect(page.getByText("交易订单资产").first()).toBeVisible();
  const assistant = page.frameLocator('iframe[title="企业业务智能助手"]');
  await expect(assistant.getByRole("heading", { name: "业务智能助手" })).toBeVisible();

  const input = assistant.getByPlaceholder(/询问.*交易订单资产/);
  await input.fill("当前数据质量怎么样？");
  await input.press("Enter");
  await expect(
    assistant.getByText(/Product B 数据资产平台中的订单数据当前质量得分为 96%/),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(assistant.getByText("可信依据")).toBeVisible();
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({ path: "../../docs/demo-product-b.png", fullPage: true });
});

test("Product B updates assistant context when the host asset changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /客户画像资产/ }).click();
  await expect(page.getByText("/assets/catalog/customers")).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="企业业务智能助手"]').getByPlaceholder(/询问.*客户画像资产/),
  ).toBeVisible();
});
