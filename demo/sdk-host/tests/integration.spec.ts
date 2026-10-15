import { expect, test } from "@playwright/test";

test("React SDK captures page context per run and applies X to Y on the next run", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "同一助手，三种宿主" })).toBeVisible();
  await page.getByPlaceholder(/询问.*订单数据集/).fill("检查订单质量");
  await page.getByPlaceholder(/询问.*订单数据集/).press("Enter");
  await expect(page.getByText(/订单数据集当前质量得分为 96%/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "客户数据集" }).click();
  await expect(page.getByPlaceholder(/询问.*客户数据集/)).toBeVisible();
  await page.getByPlaceholder(/询问.*客户数据集/).fill("检查客户质量");
  await page.getByPlaceholder(/询问.*客户数据集/).press("Enter");
  await expect(page.getByText(/客户数据集当前质量得分为 96%/)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "../../docs/m4-preview.png", fullPage: true });
});

test("JavaScript SDK mounts and destroys in the same host surface", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "JavaScript SDK" }).click();
  await expect(page.getByRole("heading", { name: "数据证据工作台" })).toBeVisible();
  await expect(page.getByPlaceholder(/询问.*订单数据集/)).toBeVisible();
  await page.getByRole("button", { name: "React SDK" }).click();
  await expect(page.locator(".assistant-sdk-root")).toHaveCount(1);
});

test("cross-origin iframe bootstraps with a one-time ticket and no URL credential", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "跨域 iframe" }).click();
  const frameElement = page.locator("iframe");
  await expect(frameElement).toBeVisible();
  const src = await frameElement.getAttribute("src");
  expect(src).not.toContain("token");
  expect(src).not.toContain("ticket");
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("heading", { name: "数据证据工作台" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(frame.getByPlaceholder(/询问.*订单数据集/)).toBeVisible();
});
