import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const SHOP_DEMO_EMAIL = "alex@example.com";
const SHOP_DEMO_PASSWORD = "Password1";

test.describe("Shop account", () => {
  test("signs in with a demo account, opens orders, and signs out", async ({
    page,
  }) => {
    await page.goto("/shop/sign-in");
    await page.getByLabel("Email").fill(SHOP_DEMO_EMAIL);
    await page.getByLabel("Password").fill(SHOP_DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Hi, Alex")).toBeVisible();

    await page.getByRole("link", { name: "My orders" }).click();
    await expect(page).toHaveURL(/\/shop\/orders/);
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("rejects invalid sign-in credentials and validates registration input", async ({
    page,
  }) => {
    await page.goto("/shop/sign-in");
    await page.getByLabel("Email").fill(`unknown-${randomUUID()}@example.test`);
    await page.getByLabel("Password").fill("invalid-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(
      "Incorrect email or password.",
    );

    await page.goto("/shop/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/shop\/register/);
  });
});
