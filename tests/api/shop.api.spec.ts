import { randomUUID } from "node:crypto";
import { expect, test } from "../fixtures/api";
import { PROMO_CODES } from "../constants";

type ShopProduct = {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
};

type ShopProductDetail = ShopProduct & {
  option?: {
    label: string;
    choices: Array<{ name: string; priceDeltaCents: number }>;
  };
  reviews: Array<{ author: string; rating: number; text: string }>;
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

    const filteredResponse = await api.get(
      "/api/shop/products?category=tvs&q=aurora",
    );
    expect(filteredResponse.status()).toBe(200);
    const filtered = (await filteredResponse.json()) as {
      products: ShopProduct[];
    };
    expect(filtered.products.length).toBeGreaterThan(0);
    expect(
      filtered.products.every(
        (product) =>
          product.category === "tvs" &&
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

  test("sorts the catalog and validates pagination boundaries", async ({
    api,
  }) => {
    const featuredResponse = await api.get("/api/shop/products?sort=featured");
    expect(featuredResponse.status()).toBe(200);
    const featured = (await featuredResponse.json()) as {
      products: ShopProduct[];
    };

    const defaultResponse = await api.get("/api/shop/products");
    expect(defaultResponse.status()).toBe(200);
    const defaultPage = (await defaultResponse.json()) as {
      products: ShopProduct[];
    };
    expect(featured.products.map((product) => product.slug)).toEqual(
      defaultPage.products.map((product) => product.slug),
    );

    const ascendingResponse = await api.get(
      "/api/shop/products?sort=price-asc",
    );
    expect(ascendingResponse.status()).toBe(200);
    const ascending = (await ascendingResponse.json()) as {
      products: ShopProduct[];
    };
    const ascendingPrices = ascending.products.map(
      (product) => product.priceCents,
    );
    expect(ascendingPrices).toEqual(
      [...ascendingPrices].sort((left, right) => left - right),
    );

    const descendingResponse = await api.get(
      "/api/shop/products?sort=price-desc",
    );
    expect(descendingResponse.status()).toBe(200);
    const descending = (await descendingResponse.json()) as {
      products: ShopProduct[];
    };
    const descendingPrices = descending.products.map(
      (product) => product.priceCents,
    );
    expect(descendingPrices).toEqual(
      [...descendingPrices].sort((left, right) => right - left),
    );

    const alphabeticalResponse = await api.get("/api/shop/products?sort=name");
    expect(alphabeticalResponse.status()).toBe(200);
    const alphabetical = (await alphabeticalResponse.json()) as {
      products: ShopProduct[];
    };
    const names = alphabetical.products.map((product) =>
      product.name.toLowerCase(),
    );
    expect(names).toEqual([...names].sort());

    const firstPageResponse = await api.get("/api/shop/products?page=1");
    expect(firstPageResponse.status()).toBe(200);
    const firstPage = (await firstPageResponse.json()) as {
      products: ShopProduct[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    expect(firstPage.page).toBe(1);
    expect(firstPage.pageSize).toBeGreaterThan(0);
    expect(firstPage.total).toBeGreaterThan(firstPage.pageSize);
    expect(firstPage.totalPages).toBeGreaterThan(1);

    const allSlugs: string[] = [];
    for (let page = 1; page <= firstPage.totalPages; page += 1) {
      const response = await api.get(`/api/shop/products?page=${page}`);
      expect(response.status()).toBe(200);
      const result = (await response.json()) as {
        products: ShopProduct[];
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
      expect(result.page).toBe(page);
      expect(result.total).toBe(firstPage.total);
      expect(result.totalPages).toBe(firstPage.totalPages);
      expect(result.products.length).toBeLessThanOrEqual(result.pageSize);
      allSlugs.push(...result.products.map((product) => product.slug));
    }
    expect(allSlugs).toHaveLength(firstPage.total);
    expect(new Set(allSlugs).size).toBe(firstPage.total);

    const beyondLastPage = await api.get(
      `/api/shop/products?page=${firstPage.totalPages + 1}`,
    );
    expect(beyondLastPage.status()).toBe(200);
    expect((await beyondLastPage.json()).products).toEqual([]);

    const invalidPage = await api.get("/api/shop/products?page=0");
    expect(invalidPage.status()).toBe(400);
    expect(await invalidPage.json()).toMatchObject({
      error: "page must be a positive integer",
    });
    expect(
      (await api.get("/api/shop/products?page=not-a-number")).status(),
    ).toBe(400);

    const invalidSort = await api.get("/api/shop/products?sort=not-supported");
    expect(invalidSort.status()).toBe(400);
    expect(await invalidSort.json()).toMatchObject({
      error: "sort must be featured, price-asc, price-desc or name",
    });
  });

  test("returns details for every catalog product and handles an unknown slug", async ({
    api,
  }) => {
    const listing = await api.get("/api/shop/products?page=1");
    expect(listing.status()).toBe(200);
    const firstPage = (await listing.json()) as {
      products: ShopProduct[];
      total: number;
      totalPages: number;
    };
    const catalog = [...firstPage.products];
    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const response = await api.get(`/api/shop/products?page=${page}`);
      expect(response.status()).toBe(200);
      const result = (await response.json()) as { products: ShopProduct[] };
      catalog.push(...result.products);
    }
    expect(catalog).toHaveLength(firstPage.total);

    for (const summary of catalog) {
      const response = await api.get(
        `/api/shop/products/${encodeURIComponent(summary.slug)}`,
      );
      expect(response.status()).toBe(200);
      const product = (await response.json()) as ShopProductDetail;
      expect(product).toMatchObject({
        slug: summary.slug,
        name: summary.name,
        category: summary.category,
        priceCents: summary.priceCents,
        stock: summary.stock,
      });
      expect(product.reviews).toBeInstanceOf(Array);
    }

    const response = await api.get("/api/shop/products/aurora-4k-tv");
    expect(response.status()).toBe(200);
    const product = (await response.json()) as ShopProductDetail;
    expect(product.slug).toBe("aurora-4k-tv");
    expect(product.option?.choices.map((choice) => choice.name)).toContain(
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

  test("adds every TV size and laptop storage option as a distinct cart line", async ({
    api,
  }) => {
    const variants = [
      {
        slug: "aurora-4k-tv",
        optionLabel: "Screen size",
        option: "55 inch",
        unitCents: 59999,
      },
      {
        slug: "aurora-4k-tv",
        optionLabel: "Screen size",
        option: "65 inch",
        unitCents: 89999,
      },
      {
        slug: "nimbus-14-laptop",
        optionLabel: "Storage",
        option: "512 GB",
        unitCents: 89900,
      },
      {
        slug: "nimbus-14-laptop",
        optionLabel: "Storage",
        option: "1 TB",
        unitCents: 104900,
      },
      {
        slug: "nimbus-16-pro-laptop",
        optionLabel: "Storage",
        option: "512 GB",
        unitCents: 179900,
      },
      {
        slug: "nimbus-16-pro-laptop",
        optionLabel: "Storage",
        option: "1 TB",
        unitCents: 194900,
      },
    ];
    const headers = cartHeaders(newCartId());

    try {
      let expectedLineCount = 0;
      for (const variant of variants) {
        const added = await api.post("/api/shop/cart/items", {
          headers,
          data: {
            slug: variant.slug,
            quantity: 1,
            option: variant.option,
          },
        });
        expect(added.status()).toBe(201);
        const cart = (await added.json()) as {
          items: Array<{
            slug: string;
            option: string;
            optionLabel: string;
            quantity: number;
            unitCents: number;
            lineCents: number;
          }>;
        };
        expectedLineCount += 1;
        expect(cart.items).toHaveLength(expectedLineCount);
        expect(cart.items).toContainEqual(
          expect.objectContaining({
            slug: variant.slug,
            option: variant.option,
            optionLabel: variant.optionLabel,
            quantity: 1,
            unitCents: variant.unitCents,
            lineCents: variant.unitCents,
          }),
        );
      }
    } finally {
      const currentCart = await api.get("/api/shop/cart", { headers });
      expect(currentCart.status()).toBe(200);
      const cart = (await currentCart.json()) as {
        items: Array<{ id: string }>;
      };
      for (const item of cart.items) {
        const removed = await api.delete(
          `/api/shop/cart/items/${encodeURIComponent(item.id)}`,
          { headers },
        );
        expect(removed.status()).toBe(200);
      }
    }
  });

  test("requires a valid cart identifier and rejects invalid cart items", async ({
    api,
  }) => {
    const missingHeader = await api.get("/api/shop/cart");
    expect(missingHeader.status()).toBe(400);
    expect(await missingHeader.json()).toMatchObject({
      error:
        "The X-Shop-Cart header is required (8–64 letters, digits, - or _)",
    });

    for (const cartId of ["1234567", "a".repeat(65), "invalid.cart"]) {
      const invalidCart = await api.get("/api/shop/cart", {
        headers: cartHeaders(cartId),
      });
      expect(invalidCart.status()).toBe(400);
      expect(await invalidCart.json()).toMatchObject({
        error:
          "The X-Shop-Cart header is required (8–64 letters, digits, - or _)",
      });
    }

    for (const cartId of ["12345678", "a".repeat(64), "abc_def-1"]) {
      const validCart = await api.get("/api/shop/cart", {
        headers: cartHeaders(cartId),
      });
      expect(validCart.status()).toBe(200);
      expect((await validCart.json()).id).toBe(cartId);
    }

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

    const soldOut = await api.post("/api/shop/cart/items", {
      headers,
      data: { slug: "cinema-qled-tv", quantity: 1, option: null },
    });
    expect(soldOut.status()).toBe(409);
    expect(await soldOut.json()).toMatchObject({
      code: "SOLD_OUT",
      error: "Cinema QLED TV is sold out",
    });

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

  test("accepts quantities from one through available stock and rejects the next item", async ({
    api,
  }) => {
    const headers = cartHeaders(newCartId());
    const product = { slug: "nimbus-16-pro-laptop", option: "512 GB" };

    try {
      const belowMinimum = await api.post("/api/shop/cart/items", {
        headers,
        data: { ...product, quantity: 0 },
      });
      expect(belowMinimum.status()).toBe(400);
      expect(await belowMinimum.json()).toMatchObject({
        error: "quantity must be an integer between 1 and 99",
      });

      const aboveInputRange = await api.post("/api/shop/cart/items", {
        headers,
        data: { ...product, quantity: 100 },
      });
      expect(aboveInputRange.status()).toBe(400);
      expect(await aboveInputRange.json()).toMatchObject({
        error: "quantity must be an integer between 1 and 99",
      });

      const minimum = await api.post("/api/shop/cart/items", {
        headers,
        data: { ...product, quantity: 1 },
      });
      expect(minimum.status()).toBe(201);
      expect((await minimum.json()).items[0]).toMatchObject({
        quantity: 1,
        stock: 4,
      });

      const atStockLimit = await api.post("/api/shop/cart/items", {
        headers,
        data: { ...product, quantity: 3 },
      });
      expect(atStockLimit.status()).toBe(201);
      const fullCart = (await atStockLimit.json()) as {
        items: Array<{ id: string; quantity: number; stock: number }>;
      };
      expect(fullCart.items[0]).toMatchObject({
        quantity: 4,
        stock: 4,
      });

      const updateAboveStock = await api.patch(
        `/api/shop/cart/items/${encodeURIComponent(fullCart.items[0].id)}`,
        { headers, data: { quantity: 5 } },
      );
      expect(updateAboveStock.status()).toBe(409);
      expect(await updateAboveStock.json()).toMatchObject({
        code: "STOCK_LIMIT",
      });

      const aboveStockLimit = await api.post("/api/shop/cart/items", {
        headers,
        data: { ...product, quantity: 1 },
      });
      expect(aboveStockLimit.status()).toBe(409);
      expect(await aboveStockLimit.json()).toMatchObject({
        code: "STOCK_LIMIT",
        error: "Only 4 of Nimbus 16 Pro Laptop available",
      });
    } finally {
      const currentCart = await api.get("/api/shop/cart", { headers });
      expect(currentCart.status()).toBe(200);
      const cart = (await currentCart.json()) as {
        items: Array<{ id: string }>;
      };
      for (const item of cart.items) {
        const removed = await api.delete(
          `/api/shop/cart/items/${encodeURIComponent(item.id)}`,
          { headers },
        );
        expect(removed.status()).toBe(200);
      }
    }
  });

  test("reports an unknown promo code without corrupting the cart", async ({
    api,
  }) => {
    const headers = cartHeaders(newCartId());
    try {
      const added = await api.post("/api/shop/cart/items", {
        headers,
        data: { slug: "compact-hd-tv", quantity: 1, option: null },
      });
      expect(added.status()).toBe(201);

      const response = await api.post("/api/shop/cart/promo", {
        headers,
        data: { code: `NO-SUCH-PROMO-${randomUUID()}` },
      });
      expect(response.status()).toBe(404);
      expect(await response.json()).toMatchObject({
        code: "PROMO_UNKNOWN",
        error: "This promo code does not exist.",
      });

      const unchanged = await api.get("/api/shop/cart", { headers });
      expect(unchanged.status()).toBe(200);
      expect(await unchanged.json()).toMatchObject({
        itemCount: 1,
        subtotalCents: 19900,
        discountCents: 0,
        totalCents: 19900,
      });
    } finally {
      const currentCart = await api.get("/api/shop/cart", { headers });
      expect(currentCart.status()).toBe(200);
      const cart = (await currentCart.json()) as {
        items: Array<{ id: string }>;
      };
      for (const item of cart.items) {
        const removed = await api.delete(
          `/api/shop/cart/items/${encodeURIComponent(item.id)}`,
          { headers },
        );
        expect(removed.status()).toBe(200);
      }
    }
  });

  test("applies percentage and minimum-spend promos and removes discounts", async ({
    api,
  }) => {
    const headers = cartHeaders(newCartId());
    try {
      const firstItem = await api.post("/api/shop/cart/items", {
        headers,
        data: { slug: "compact-hd-tv", quantity: 1, option: null },
      });
      expect(firstItem.status()).toBe(201);

      const minimumSpendPromo = await api.post("/api/shop/cart/promo", {
        headers,
        data: { code: PROMO_CODES.welcome20 },
      });
      expect(minimumSpendPromo.status()).toBe(200);
      expect(await minimumSpendPromo.json()).toMatchObject({
        promo: PROMO_CODES.welcome20,
        promoWarning: "WELCOME20 needs a minimum spend of $200.00.",
        subtotalCents: 19900,
        discountCents: 0,
        totalCents: 19900,
      });

      const secondItem = await api.post("/api/shop/cart/items", {
        headers,
        data: { slug: "compact-hd-tv", quantity: 1, option: null },
      });
      expect(secondItem.status()).toBe(201);
      expect(await secondItem.json()).toMatchObject({
        promo: PROMO_CODES.welcome20,
        subtotalCents: 39800,
        discountCents: 2000,
        totalCents: 37800,
      });

      const replacementPromo = await api.post("/api/shop/cart/promo", {
        headers,
        data: { code: PROMO_CODES.save10 },
      });
      expect(replacementPromo.status()).toBe(200);
      expect(await replacementPromo.json()).toMatchObject({
        promo: PROMO_CODES.save10,
        subtotalCents: 39800,
        discountCents: 3980,
        totalCents: 35820,
      });

      const removedPromo = await api.delete("/api/shop/cart/promo", {
        headers,
      });
      expect(removedPromo.status()).toBe(200);
      expect(await removedPromo.json()).toMatchObject({
        discountCents: 0,
        totalCents: 39800,
      });
    } finally {
      const currentCart = await api.get("/api/shop/cart", { headers });
      expect(currentCart.status()).toBe(200);
      const cart = (await currentCart.json()) as {
        items: Array<{ id: string }>;
      };
      for (const item of cart.items) {
        const removed = await api.delete(
          `/api/shop/cart/items/${encodeURIComponent(item.id)}`,
          { headers },
        );
        expect(removed.status()).toBe(200);
      }
    }
  });

  test("accepts free-shipping promo and rejects an expired promo", async ({
    api,
  }) => {
    const headers = cartHeaders(newCartId());
    try {
      const added = await api.post("/api/shop/cart/items", {
        headers,
        data: { slug: "compact-hd-tv", quantity: 1, option: null },
      });
      expect(added.status()).toBe(201);

      const freeShipping = await api.post("/api/shop/cart/promo", {
        headers,
        data: { code: PROMO_CODES.freeShip },
      });
      expect(freeShipping.status()).toBe(200);
      expect(await freeShipping.json()).toMatchObject({
        promo: PROMO_CODES.freeShip,
        discountCents: 0,
      });

      const expressCart = await api.get("/api/shop/cart?delivery=express", {
        headers,
      });
      expect(expressCart.status()).toBe(200);
      expect((await expressCart.json()).deliveryCents).toBe(1999);

      const expiredPromo = await api.post("/api/shop/cart/promo", {
        headers,
        data: { code: PROMO_CODES.expired },
      });
      expect(expiredPromo.status()).toBe(410);
      expect(await expiredPromo.json()).toMatchObject({
        code: "PROMO_EXPIRED",
        error: "This promo code has expired.",
      });
    } finally {
      const removePromo = await api.delete("/api/shop/cart/promo", { headers });
      expect(removePromo.status()).toBe(200);

      const currentCart = await api.get("/api/shop/cart", { headers });
      expect(currentCart.status()).toBe(200);
      const cart = (await currentCart.json()) as {
        items: Array<{ id: string }>;
      };
      for (const item of cart.items) {
        const removed = await api.delete(
          `/api/shop/cart/items/${encodeURIComponent(item.id)}`,
          { headers },
        );
        expect(removed.status()).toBe(200);
      }
    }
  });

  test("requires authentication for Shop account resources", async ({
    api,
  }) => {
    expect((await api.get("/api/shop/me")).status()).toBe(401);
    expect(
      (
        await api.get("/api/shop/me", {
          headers: { Authorization: "Bearer invalid-token" },
        })
      ).status(),
    ).toBe(401);

    const invalidLogin = await api.post("/api/shop/login", {
      data: {
        email: `${randomUUID()}@example.test`,
        password: "invalid-password",
      },
    });
    expect(invalidLogin.status()).toBe(401);

    const lockedLogin = await api.post("/api/shop/login", {
      data: { email: "locked@example.com", password: "Password1" },
    });
    expect(lockedLogin.status()).toBe(403);
    expect(await lockedLogin.json()).toMatchObject({
      code: "ACCOUNT_LOCKED",
      error: "This account is locked. Contact support.",
    });
  });

  test("signs in with the published demo account and reads the account", async ({
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
  });

  test("validates registration without creating a user", async ({ api }) => {
    const registration = await api.post("/api/shop/register", {
      data: { name: "", email: "not-an-email", password: "x" },
    });
    expect(registration.status()).toBe(400);
  });
});
