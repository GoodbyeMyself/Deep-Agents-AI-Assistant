import { expect, test } from "@playwright/test";

test("runs a trusted quality query and exposes evidence", async ({ page }) => {
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "数据证据工作台" })).toBeVisible();
  await page.getByRole("button", { name: "新建会话" }).first().click();
  await page.getByPlaceholder(/询问.*订单数据集/).fill("分析最近一周的订单数据质量趋势");
  await page.getByPlaceholder(/询问.*订单数据集/).press("Enter");
  await expect(page.getByText(/质量分.*96%|96%.*质量/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".ant-sources-title").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("质量趋势").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/执行完成/).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "../../docs/m3-preview.png", fullPage: true });
});

test("keeps the current page after refresh", async ({ page }) => {
  await page.goto("/runtime");
  await expect(page.getByText("管理员可查看插件运行明细")).toBeVisible();
  await page.reload();
  await expect(page.getByText("管理员可查看插件运行明细")).toBeVisible();
  await expect(page).toHaveURL(/\/runtime$/);
});

test("keeps administrative plugin status separated", async ({ page }) => {
  await page.goto("/runtime");
  await expect(page.getByText("管理员可查看插件运行明细")).toBeVisible();
  await page.getByLabel("本地模拟身份").click();
  await page.getByText("平台管理员", { exact: true }).click();
  await expect(page.getByText("demo-product-a")).toBeVisible();
});

test("keeps the primary assistant usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "数据证据工作台" })).toBeVisible();
  await expect(page.getByPlaceholder(/询问.*订单数据集/)).toBeVisible();
  await expect(page.getByLabel("会话列表")).toBeHidden();
});
