import { randomUUID } from "node:crypto";
import { expect, test } from "../fixtures/api";

test.describe("Utility APIs", () => {
  test("searches products and validates employee pagination boundaries", async ({
    api,
  }) => {
    const products = await api.get("/api/products?search=keyboard");
    expect(products.status()).toBe(200);
    const productBody = (await products.json()) as {
      products: Array<{ name: string }>;
    };
    expect(productBody.products.length).toBeGreaterThan(0);
    expect(
      productBody.products.every((product) =>
        product.name.toLowerCase().includes("keyboard"),
      ),
    ).toBe(true);

    const noProducts = await api.get("/api/products?search=no-such-qa-product");
    expect(noProducts.status()).toBe(200);
    expect((await noProducts.json()).products).toHaveLength(0);

    const firstPage = await api.get("/api/employees?page=1&pageSize=5");
    expect(firstPage.status()).toBe(200);
    const pageBody = (await firstPage.json()) as {
      employees: unknown[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    expect(pageBody.page).toBe(1);
    expect(pageBody.pageSize).toBe(5);
    expect(pageBody.employees).toHaveLength(5);
    expect(pageBody.total).toBeGreaterThanOrEqual(pageBody.employees.length);
    expect(pageBody.totalPages).toBeGreaterThan(0);

    expect((await api.get("/api/employees?pageSize=51")).status()).toBe(400);
    expect((await api.get("/api/employees?page=0")).status()).toBe(400);
  });

  test("returns notifications, city matches, and username availability", async ({
    api,
  }) => {
    const notifications = await api.get("/api/notifications");
    expect(notifications.status()).toBe(200);
    expect((await notifications.json()).notifications).toBeInstanceOf(Array);

    const cities = await api.get("/api/cities?search=tor");
    expect(cities.status()).toBe(200);
    const cityList = (await cities.json()).cities as string[];
    expect(cityList).toContain("Toronto, Canada");
    expect(cityList.length).toBeLessThanOrEqual(8);

    const username = `qa_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const availability = await api.get(`/api/usernames/${username}`);
    expect(availability.status()).toBe(200);
    expect(await availability.json()).toMatchObject({
      username,
      available: expect.any(Boolean),
    });
    expect((await api.get("/api/usernames/x")).status()).toBe(400);
  });

  test("validates registrations and reports taken email addresses", async ({
    api,
  }) => {
    const email = `qa-${randomUUID()}@example.test`;
    const valid = await api.post("/api/register", { data: { email, age: 30 } });
    expect(valid.status()).toBe(201);
    expect(await valid.json()).toMatchObject({ email, age: 30 });

    const invalid = await api.post("/api/register", {
      data: { email: "not-an-email", age: -1 },
    });
    expect(invalid.status()).toBe(400);

    const taken = await api.post("/api/register", {
      data: { email: "taken@example.com", age: 30 },
    });
    expect(taken.status()).toBe(409);
  });

  test("accepts a small upload and rejects empty and oversized uploads", async ({
    api,
  }) => {
    const upload = await api.post("/api/upload", {
      multipart: {
        files: {
          name: "qa-note.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Playwright API upload test"),
        },
      },
    });
    expect(upload.status()).toBe(200);
    const uploadBody = (await upload.json()) as {
      files: Array<{ name: string; size: number; type: string }>;
      totalBytes: number;
    };
    expect(uploadBody.files).toHaveLength(1);
    expect(uploadBody.files[0]).toMatchObject({
      name: "qa-note.txt",
      type: "text/plain",
    });
    expect(uploadBody.totalBytes).toBeGreaterThan(0);

    const empty = await api.post("/api/upload");
    expect(empty.status()).toBe(400);

    const oversized = await api.post("/api/upload", {
      multipart: {
        files: {
          name: "too-large.bin",
          mimeType: "application/octet-stream",
          buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
        },
      },
      timeout: 30000,
    });
    expect(oversized.status()).toBe(413);
  });

  test("serves the monthly report as a downloadable text file", async ({
    api,
  }) => {
    const response = await api.get("/api/reports/monthly");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect(await response.text()).not.toHaveLength(0);
  });

  test("rejects incorrect checkout totals and includes a request ID", async ({
    api,
  }) => {
    const response = await api.post("/api/checkout/pay", {
      data: { total: 0 },
    });
    expect([400, 422]).toContain(response.status());
    expect(response.headers()["x-request-id"]).toBeTruthy();
  });

  test("[@mutating] creates a simulated test payment", async ({ api }) => {
    // Order creation is intentionally excluded from routine runs.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_MUTATING_TESTS !== "true",
      "Creates a simulated checkout order; set RUN_MUTATING_TESTS=true to run.",
    );

    const cartResponse = await api.get("/api/checkout/cart");
    expect(cartResponse.status()).toBe(200);
    const cart = (await cartResponse.json()) as {
      items: unknown[];
      subtotal: number;
    };
    expect(cart.items.length).toBeGreaterThan(0);
    expect(cart.subtotal).toBeGreaterThan(0);

    const shippingResponse = await api.get("/api/checkout/shipping");
    expect(shippingResponse.status()).toBe(200);
    const shipping = (await shippingResponse.json()) as { shipping: number };
    expect(shipping.shipping).toBeGreaterThanOrEqual(0);

    const total = cart.subtotal + shipping.shipping;
    const payment = await api.post("/api/checkout/pay", { data: { total } });
    expect(payment.status()).toBe(201);
    expect(payment.headers()["x-request-id"]).toBeTruthy();
    const paymentBody = (await payment.json()) as { order: string };
    expect(paymentBody.order).toBeTruthy();

    const lookup = await api.get(
      `/api/checkout/payments/${encodeURIComponent(paymentBody.order)}`,
    );
    expect(lookup.status()).toBe(200);
    expect(await lookup.json()).toMatchObject({
      id: paymentBody.order,
      failed: expect.any(Boolean),
    });
  });

  test("returns the requested status and rejects status values outside the range", async ({
    api,
  }) => {
    expect((await api.get("/api/status/418")).status()).toBe(418);
    expect((await api.get("/api/status/199")).status()).toBe(400);
    expect((await api.get("/api/status/600")).status()).toBe(400);
    expect((await api.get("/api/status/not-a-number")).status()).toBe(400);
  });

  test("resets the current demo user only when explicitly enabled", async ({
    api,
  }) => {
    // Reset invalidates tokens and is never part of routine CI.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_RESET_API_TEST !== "true",
      "Set RUN_RESET_API_TEST=true to run the state-reset test.",
    );
    const response = await api.post("/api/reset");
    expect(response.status()).toBe(204);
  });
});
