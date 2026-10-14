import { expect, test } from "@playwright/test";

test("runs a trusted quality query and exposes evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据证据工作台" })).toBeVisible();
  await page.getByPlaceholder(/询问.*订单数据集/).fill("分析最近一周的订单数据质量趋势");
  await page.getByPlaceholder(/询问.*订单数据集/).press("Enter");
  await expect(page.getByText(/订单数据集当前质量得分为 96%/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("可信依据")).toBeVisible();
  await expect(page.getByText("质量趋势")).toBeVisible();
  await expect(page.getByText("分析完成")).toBeVisible();
  await page.screenshot({ path: "../../docs/m3-preview.png", fullPage: true });
});

test("keeps administrative plugin status separated", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "运行状态" }).click();
  await expect(page.getByText("管理员可查看插件运行明细")).toBeVisible();
  await page.getByLabel("本地模拟身份").click();
  await page.getByText("平台管理员", { exact: true }).click();
  await expect(page.getByText("demo-product-a")).toBeVisible();
});

test("keeps the primary assistant usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "数据证据工作台" })).toBeVisible();
  await expect(page.getByPlaceholder(/询问.*订单数据集/)).toBeVisible();
  await expect(page.getByLabel("会话列表")).toBeHidden();
});
