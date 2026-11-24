import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const appUrl = process.env.APP_BASE_URL ?? "https://playwright-playground.com";
const apiUrl = process.env.API_BASE_URL ?? appUrl;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "web-chromium",
      testMatch: "**/*.web.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: appUrl },
    },
    {
      name: "web-firefox",
      testMatch: "**/*.web.spec.ts",
      use: { ...devices["Desktop Firefox"], baseURL: appUrl },
    },
    {
      name: "web-webkit",
      testMatch: "**/*.web.spec.ts",
      use: { ...devices["Desktop Safari"], baseURL: appUrl },
    },
    {
      name: "api",
      testMatch: "**/*.api.spec.ts",
      use: { baseURL: apiUrl },
    },
  ],
});
