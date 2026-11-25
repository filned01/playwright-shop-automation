import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { SHOP_DEMO_ACCOUNT, TEST_CARDS } from "../constants";
import { buildOrderPayload } from "../api/order-payload";

test.describe("Shop account", () => {
  test("signs in with a demo account, opens orders, and signs out", async ({
    page,
  }) => {
    await page.goto("/shop/sign-in");
    await page.getByLabel("Email").fill(SHOP_DEMO_ACCOUNT.email);
    await page.getByLabel("Password").fill(SHOP_DEMO_ACCOUNT.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Hi, Alex")).toBeVisible();

    await page.getByRole("link", { name: "My orders" }).click();
    await expect(page).toHaveURL(/\/shop\/orders/);
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("[@mutating] shows an API-created order in the signed-in order history", async ({
    page,
  }) => {
    // Order creation mutates shared demo data, so keep this opt-in.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_MUTATING_TESTS !== "true",
      "Creates a simulated order; set RUN_MUTATING_TESTS=true to run.",
    );

    await page.goto("/shop/sign-in");
    await page.getByLabel("Email").fill(SHOP_DEMO_ACCOUNT.email);
    await page.getByLabel("Password").fill(SHOP_DEMO_ACCOUNT.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Hi, Alex")).toBeVisible();

    const api = page.context().request;
    const apiUrl = (path: string) => new URL(path, page.url()).toString();
    const login = await api.post(apiUrl("/api/shop/login"), {
      data: SHOP_DEMO_ACCOUNT,
    });
    expect(login.status()).toBe(200);
    const { token } = (await login.json()) as { token: string };
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Shop-Cart": `qa-${randomUUID()}`,
    };

    let orderId: string | undefined;
    try {
      const added = await api.post(apiUrl("/api/shop/cart/items"), {
        headers,
        data: { slug: "compact-hd-tv", quantity: 1, option: null },
      });
      expect(added.status()).toBe(201);

      const created = await api.post(apiUrl("/api/shop/orders"), {
        headers,
        data: buildOrderPayload(SHOP_DEMO_ACCOUNT.email, {
          cardNumber: TEST_CARDS.success,
        }),
      });
      expect(created.status()).toBe(201);
      const order = (await created.json()) as {
        id: string;
        status: string;
      };
      orderId = order.id;
      expect(order.status).toBe("Processing");

      await page.getByRole("link", { name: "My orders" }).click();
      await expect(page).toHaveURL(/\/shop\/orders/);
      await expect(page.getByText(order.id)).toBeVisible();
    } finally {
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (orderId) {
        const current = await api.get(
          apiUrl(`/api/shop/orders/${encodeURIComponent(orderId)}`),
          { headers },
        );
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(current.status()).toBe(200);
        const currentOrder = (await current.json()) as { status: string };
        // eslint-disable-next-line playwright/no-conditional-in-test
        if (currentOrder.status === "Processing") {
          const cancelled = await api.post(
            apiUrl(`/api/shop/orders/${encodeURIComponent(orderId)}/cancel`),
            { headers },
          );
          // eslint-disable-next-line playwright/no-conditional-expect
          expect(cancelled.status()).toBe(200);
        } else {
          // eslint-disable-next-line playwright/no-conditional-expect
          expect(currentOrder.status).toBe("Shipped");
        }
      }
    }
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
