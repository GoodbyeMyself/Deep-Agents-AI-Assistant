import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 40_000,
  globalSetup: "./tests/setup.ts",
  use: { baseURL: "http://127.0.0.1:5411", trace: "retain-on-failure" },
});
