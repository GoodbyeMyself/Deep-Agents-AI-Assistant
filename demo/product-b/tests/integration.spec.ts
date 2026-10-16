import { expect, test } from "@playwright/test";

test("Product B floating assistant stays fixed while the host page scrolls", async ({ page }) => {
  await page.goto("/");

  const launcher = page.getByRole("button", { name: "打开智能助手" });
  const panel = page.locator(".floating-assistant-panel");
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("position", "fixed");
  await expect(panel).toHaveCSS("opacity", "1");

  const beforeScroll = await panel.evaluate((element) => element.getBoundingClientRect().bottom);
  await page.evaluate(() => globalThis.scrollTo(0, document.body.scrollHeight));
  const afterScroll = await panel.evaluate((element) => element.getBoundingClientRect().bottom);
  expect(afterScroll).toBeCloseTo(beforeScroll, 1);

  await page.getByRole("button", { name: "关闭智能助手" }).click();
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole("button", { name: "打开智能助手" })).toBeVisible();
});

test("Product B embeds the same assistant contract over its own adapter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据资产驾驶舱" })).toBeVisible();
  await expect(page.getByText("NORTHSTAR OPS")).toBeVisible();
  await expect(page.getByText("交易订单资产").first()).toBeVisible();
  await page.getByRole("button", { name: "打开智能助手" }).click();
  await expect(page.locator(".floating-assistant-panel")).toHaveCSS("position", "fixed");
  const assistant = page.frameLocator('iframe[title="企业业务智能助手"]');
  await expect(assistant.getByRole("heading", { name: "业务智能助手" })).toBeVisible();

  const input = assistant.getByPlaceholder(/询问.*交易订单资产/);
  await input.fill("当前数据质量怎么样？");
  await input.press("Enter");
  await expect(assistant.getByText("助手正在执行")).toBeVisible();
  await expect(assistant.getByText("助手已就绪")).toBeVisible({ timeout: 60_000 });
  await expect(assistant.getByText(/96%/).last()).toBeVisible();
  await expect(assistant.getByText("可信依据").last()).toBeVisible();
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({ path: "../../docs/demo-product-b.png", fullPage: true });
});

test("Product B updates assistant context when the host asset changes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开智能助手" }).click();
  await page.getByRole("button", { name: "关闭智能助手" }).click();
  await page.getByRole("button", { name: /客户画像资产/ }).click();
  await page.getByRole("button", { name: "打开智能助手" }).click();
  await expect(
    page.frameLocator('iframe[title="企业业务智能助手"]').getByPlaceholder(/询问.*客户画像资产/),
  ).toBeVisible();
});
