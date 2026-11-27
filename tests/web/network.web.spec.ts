import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.describe("API playground network behavior", () => {
  test("matches GET users response data with rendered rows", async ({
    page,
  }) => {
    await page.goto("/network/api");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        /\/api\/users$/.test(response.url()),
    );
    await page.getByRole("button", { name: "GET Users" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      users: Array<{ id: number }>;
    };

    await expect(page.getByRole("row")).toHaveCount(body.users.length + 1);
  });

  test("asserts the create-user request JSON", async ({ page }) => {
    await page.goto("/network/api");

    const nonce = randomUUID().replace(/-/g, "").slice(0, 10);
    const firstName = `Network${nonce}`;
    await page.getByLabel("First name").fill(firstName);
    await page.getByLabel("Last name").fill("Automation");

    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" && /\/api\/users$/.test(request.url()),
    );
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/users$/.test(response.url()),
    );
    await page.getByRole("button", { name: "Create user" }).click();
    const request = await requestPromise;

    expect(request.postDataJSON()).toEqual({
      firstName,
      lastName: "Automation",
      role: "User",
    });

    const response = await responsePromise;
    expect(response.status()).toBe(201);
  });

  test("shows missing-user and delayed-response states", async ({ page }) => {
    await page.goto("/network/api");

    const missingResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        /\/api\/users\/999(?:\?|$)/.test(response.url()),
    );
    await page.getByRole("button", { name: "GET Missing User" }).click();
    expect((await missingResponsePromise).status()).toBe(404);
    await expect(page.getByText("User not found")).toBeVisible();

    await page.getByRole("button", { name: "GET Products — 2s Delay" }).click();
    await expect(page.getByText(/loading/i)).toBeVisible({
      timeout: 2_000,
    });
    await expect(page.getByText(/loading/i)).toBeHidden({ timeout: 10_000 });
  });
});
