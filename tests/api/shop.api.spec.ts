import { randomUUID } from "node:crypto";
import { expect, test } from "../fixtures/api";

type ShopProduct = {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
};

const newCartId = () => `qa-${randomUUID()}`;
const cartHeaders = (cartId: string) => ({ "X-Shop-Cart": cartId });

test.describe("Shop API", () => {
  test("lists products and supports category and text filters", async ({
    api,
  }) => {
    const allResponse = await api.get("/api/shop/products");
    expect(allResponse.status()).toBe(200);
    const all = (await allResponse.json()) as { products: ShopProduct[] };
    expect(all.products.length).toBeGreaterThan(0);
    expect(all.products[0]).toMatchObject({
      slug: expect.any(String),
      name: expect.any(String),
      priceCents: expect.any(Number),
      stock: expect.any(Number),
    });

    const categoryResponse = await api.get("/api/shop/products?category=tvs");
    expect(categoryResponse.status()).toBe(200);
    const category = (await categoryResponse.json()) as {
      products: ShopProduct[];
    };
    expect(category.products.length).toBeGreaterThan(0);
    expect(
      category.products.every((product) => product.category === "tvs"),
    ).toBe(true);

    const searchResponse = await api.get("/api/shop/products?q=aurora");
    expect(searchResponse.status()).toBe(200);
    const search = (await searchResponse.json()) as { products: ShopProduct[] };
    expect(search.products.length).toBeGreaterThan(0);
    expect(
      search.products.every((product) =>
        product.name.toLowerCase().includes("aurora"),
      ),
    ).toBe(true);

    const noMatchesResponse = await api.get(
      "/api/shop/products?q=no-such-qa-product",
    );
    expect(noMatchesResponse.status()).toBe(200);
    const noMatches = (await noMatchesResponse.json()) as {
      products: ShopProduct[];
    };
    expect(noMatches.products).toHaveLength(0);
  });

  test("returns product options and reviews, and handles an unknown slug", async ({
    api,
  }) => {
    const response = await api.get("/api/shop/products/aurora-4k-tv");
    expect(response.status()).toBe(200);
    const product = (await response.json()) as {
      slug: string;
      option: {
        label: string;
        choices: Array<{ name: string; priceDeltaCents: number }>;
      };
      reviews: Array<{ author: string; rating: number; text: string }>;
    };
    expect(product.slug).toBe("aurora-4k-tv");
    expect(product.option.choices.map((choice) => choice.name)).toContain(
      "55 inch",
    );
    expect(product.reviews.length).toBeGreaterThan(0);
    expect(
      product.reviews.every(
        (review) => review.rating >= 1 && review.rating <= 5,
      ),
    ).toBe(true);

    const missing = await api.get("/api/shop/products/no-such-qa-product");
    expect(missing.status()).toBe(404);
  });

  test("requires a valid cart identifier and rejects invalid cart items", async ({
    api,
  }) => {
    const missingHeader = await api.get("/api/shop/cart");
    expect(missingHeader.status()).toBe(400);

    const headers = cartHeaders(newCartId());
    const zeroQuantity = await api.post("/api/shop/cart/items", {
      headers,
      data: { slug: "compact-hd-tv", quantity: 0, option: null },
    });
    expect(zeroQuantity.status()).toBe(400);

    const missingProduct = await api.post("/api/shop/cart/items", {
      headers,
      data: { slug: "no-such-qa-product", quantity: 1, option: null },
    });
    expect(missingProduct.status()).toBe(404);

    const invalidOption = await api.post("/api/shop/cart/items", {
      headers,
      data: { slug: "aurora-4k-tv", quantity: 1, option: "invalid-option" },
    });
    expect(invalidOption.status()).toBe(400);

    const overStock = await api.post("/api/shop/cart/items", {
      headers,
      data: { slug: "compact-hd-tv", quantity: 21, option: null },
    });
    expect(overStock.status()).toBe(409);

    expect(
      (
        await api.patch("/api/shop/cart/items/no-such-line", {
          headers,
          data: { quantity: 1 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await api.delete("/api/shop/cart/items/no-such-line", { headers })
      ).status(),
    ).toBe(404);
  });

  test("prices express delivery on an isolated small cart", async ({ api }) => {
    const headers = cartHeaders(newCartId());
    const added = await api.post("/api/shop/cart/items", {
      headers,
      data: { slug: "compact-hd-tv", quantity: 1, option: null },
    });
    expect(added.status()).toBe(201);

    try {
      const standard = await api.get("/api/shop/cart", { headers });
      const express = await api.get("/api/shop/cart?delivery=express", {
        headers,
      });
      expect(standard.status()).toBe(200);
      expect(express.status()).toBe(200);
      const standardCart = (await standard.json()) as { deliveryCents: number };
      const expressCart = (await express.json()) as { deliveryCents: number };
      expect(expressCart.deliveryCents).toBeGreaterThan(
        standardCart.deliveryCents,
      );
    } finally {
      const cleanup = await api.delete("/api/shop/cart/items/compact-hd-tv", {
        headers,
      });
      expect(cleanup.status()).toBe(200);
    }
  });

  test("adds, updates, and removes an isolated cart item", async ({ api }) => {
    const headers = cartHeaders(newCartId());
    let itemId: string | undefined;

    try {
      const emptyCart = await api.get("/api/shop/cart", { headers });
      expect(emptyCart.status()).toBe(200);
      expect((await emptyCart.json()).items).toHaveLength(0);

      const added = await api.post("/api/shop/cart/items", {
        headers,
        data: { slug: "aurora-4k-tv", quantity: 1, option: "55 inch" },
      });
      expect(added.status()).toBe(201);
      const addedCart = (await added.json()) as {
        items: Array<{
          id: string;
          quantity: number;
          unitCents: number;
          lineCents: number;
        }>;
        totalCents: number;
      };
      itemId = addedCart.items[0].id;
      expect(addedCart.items[0]).toMatchObject({
        quantity: 1,
        unitCents: 59999,
        lineCents: 59999,
      });

      const updated = await api.patch(
        `/api/shop/cart/items/${encodeURIComponent(itemId)}`,
        {
          headers,
          data: { quantity: 2 },
        },
      );
      expect(updated.status()).toBe(200);
      const updatedCart = (await updated.json()) as {
        items: Array<{ id: string; quantity: number; lineCents: number }>;
        totalCents: number;
      };
      expect(updatedCart.items[0]).toMatchObject({
        id: itemId,
        quantity: 2,
        lineCents: 119998,
      });
      expect(updatedCart.totalCents).toBe(119998);

      const invalidUpdate = await api.patch(
        `/api/shop/cart/items/${encodeURIComponent(itemId)}`,
        {
          headers,
          data: { quantity: 0 },
        },
      );
      expect(invalidUpdate.status()).toBe(400);

      const removed = await api.delete(
        `/api/shop/cart/items/${encodeURIComponent(itemId)}`,
        { headers },
      );
      expect(removed.status()).toBe(200);
      itemId = undefined;

      const emptyAgain = await api.get("/api/shop/cart", { headers });
      expect(emptyAgain.status()).toBe(200);
      expect((await emptyAgain.json()).items).toHaveLength(0);
    } finally {
      // The item may not exist if setup failed before creation.
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (itemId) {
        const cleanup = await api.delete(
          `/api/shop/cart/items/${encodeURIComponent(itemId)}`,
          { headers },
        );
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(cleanup.status()).toBe(200);
      }
    }
  });

  test("reports an unknown promo code without corrupting the cart", async ({
    api,
  }) => {
    const headers = cartHeaders(newCartId());
    const response = await api.post("/api/shop/cart/promo", {
      headers,
      data: { code: `NO-SUCH-PROMO-${randomUUID()}` },
    });
    expect(response.status()).toBe(404);
    expect((await response.json()).code).toBe("PROMO_UNKNOWN");

    const removed = await api.delete("/api/shop/cart/promo", { headers });
    expect(removed.status()).toBe(200);
    expect((await removed.json()).discountCents).toBe(0);
  });

  test("requires authentication for account and order resources", async ({
    api,
  }) => {
    expect((await api.get("/api/shop/me")).status()).toBe(401);
    expect((await api.get("/api/shop/orders")).status()).toBe(401);

    const invalidLogin = await api.post("/api/shop/login", {
      data: {
        email: `${randomUUID()}@example.test`,
        password: "invalid-password",
      },
    });
    expect(invalidLogin.status()).toBe(401);
  });

  test("signs in with the published demo account and reads account and orders", async ({
    api,
  }) => {
    const login = await api.post("/api/shop/login", {
      data: { email: "alex@example.com", password: "Password1" },
    });
    expect(login.status()).toBe(200);
    const loginBody = (await login.json()) as { token: string };
    expect(loginBody.token.length).toBeGreaterThan(0);
    const headers = { Authorization: `Bearer ${loginBody.token}` };

    const account = await api.get("/api/shop/me", { headers });
    expect(account.status()).toBe(200);
    expect((await account.json()).email).toBe("alex@example.com");

    const orders = await api.get("/api/shop/orders", { headers });
    expect(orders.status()).toBe(200);
    expect((await orders.json()).orders).toBeDefined();

    const missingOrder = await api.get("/api/shop/orders/no-such-qa-order", {
      headers,
    });
    expect(missingOrder.status()).toBe(404);
    const missingCancel = await api.post(
      "/api/shop/orders/no-such-qa-order/cancel",
      { headers },
    );
    expect(missingCancel.status()).toBe(404);
  });

  test("validates registration and order requests without creating records", async ({
    api,
  }) => {
    const registration = await api.post("/api/shop/register", {
      data: { name: "", email: "not-an-email", password: "x" },
    });
    expect(registration.status()).toBe(400);

    const orderWithoutCart = await api.post("/api/shop/orders", { data: {} });
    expect(orderWithoutCart.status()).toBe(400);

    const orderWithCartButMissingDetails = await api.post("/api/shop/orders", {
      headers: cartHeaders(newCartId()),
      data: {},
    });
    expect(orderWithCartButMissingDetails.status()).toBe(400);
  });

  test("returns demo inbox messages for the requested email", async ({
    api,
  }) => {
    const response = await api.get(
      "/api/shop/inbox?email=qa-no-messages@example.test",
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).messages).toEqual([]);
  });
});
