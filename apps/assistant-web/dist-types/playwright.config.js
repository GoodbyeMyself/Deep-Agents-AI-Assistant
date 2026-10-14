import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./tests",
    timeout: 30_000,
    globalSetup: "./tests/setup.ts",
    use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
});
//# sourceMappingURL=playwright.config.js.map