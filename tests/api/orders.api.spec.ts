import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "../fixtures/api";
import {
  ORDER_DELIVERY_OPTIONS,
  SHOP_DEMO_ACCOUNT,
  TEST_CARDS,
} from "../constants";
import { InboxApi } from "./inbox-api";
import { OrdersApi } from "./orders-api";
import { buildOrderPayload } from "./order-payload";

type OrderHeaders = {
  Authorization: string;
  "X-Shop-Cart": string;
};

type PaymentFailure = {
  name: string;
  number: string;
  status: number;
  code: string;
  error: string;
};

function cartHeaders(cartId = `qa-${randomUUID()}`) {
  return { "X-Shop-Cart": cartId };
}

async function loginHeaders(
  api: APIRequestContext,
  cartId?: string,
): Promise<OrderHeaders> {
  const login = await api.post("/api/shop/login", {
    data: SHOP_DEMO_ACCOUNT,
  });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };

  return {
    ...cartHeaders(cartId),
    Authorization: `Bearer ${token}`,
  };
}

async function addItemToCart(api: APIRequestContext, headers: OrderHeaders) {
  const added = await api.post("/api/shop/cart/items", {
    headers,
    data: { slug: "compact-hd-tv", quantity: 1, option: null },
  });
  expect(added.status()).toBe(201);
}

async function expectNoOrderForEmail(
  api: APIRequestContext,
  email: string,
  headers: OrderHeaders,
  checkInbox = true,
) {
  const orders = await new OrdersApi(api).list({
    Authorization: headers.Authorization,
  });
  expect(orders.status()).toBe(200);
  expect((await orders.json()).orders).not.toContainEqual(
    expect.objectContaining({ email }),
  );

  if (checkInbox) {
    const inbox = await new InboxApi(api).list(email);
    expect(inbox.status()).toBe(200);
    expect((await inbox.json()).messages).toEqual([]);
  }

  const cart = await api.get("/api/shop/cart", { headers });
  expect(cart.status()).toBe(200);
  expect((await cart.json()).items).toHaveLength(1);
}

async function cancelIfProcessing(
  api: APIRequestContext,
  orderId: string,
  headers: OrderHeaders,
) {
  const orders = new OrdersApi(api);
  const current = await orders.get(orderId, headers);
  expect(current.status()).toBe(200);
  const currentOrder = (await current.json()) as { status: string };
  if (currentOrder.status === "Processing") {
    const cleanup = await orders.cancel(orderId, headers);
    expect(cleanup.status()).toBe(200);
  } else {
    expect(currentOrder.status).toBe("Shipped");
  }
}

async function expectPaymentFailure(
  api: APIRequestContext,
  failure: PaymentFailure,
) {
  const headers = await loginHeaders(api);
  const email = `qa-${randomUUID()}@example.test`;
  const orders = new OrdersApi(api);
  await addItemToCart(api, headers);

  let orderId: string | undefined;
  try {
    const response = await orders.create(
      headers,
      buildOrderPayload(email, { cardNumber: failure.number }),
    );
    const body = (await response.json()) as {
      id?: string;
      code?: string;
      error?: string;
    };
    if (response.status() === 201) {
      orderId = body.id;
    }

    expect(response.status()).toBe(failure.status);
    expect(body).toMatchObject({
      code: failure.code,
      error: failure.error,
    });
    await expectNoOrderForEmail(api, email, headers);
  } finally {
    // A regression that creates an order on a failed payment must not leave it behind.
    if (orderId) {
      const cleanup = await orders.cancel(orderId, headers);
      expect(cleanup.status()).toBe(200);
    }
  }
}

const failedPayments: PaymentFailure[] = [
  {
    name: "declined card",
    number: TEST_CARDS.declined,
    status: 402,
    code: "CARD_DECLINED",
    error: "Your card was declined.",
  },
  {
    name: "insufficient funds",
    number: TEST_CARDS.insufficientFunds,
    status: 402,
    code: "INSUFFICIENT_FUNDS",
    error: "Your card has insufficient funds.",
  },
  {
    name: "expired card",
    number: TEST_CARDS.expired,
    status: 402,
    code: "EXPIRED_CARD",
    error: "Your card has expired.",
  },
  {
    name: "invalid card number",
    number: TEST_CARDS.invalid,
    status: 400,
    code: "INVALID_CARD",
    error: "The card number is not valid.",
  },
  {
    name: "unlisted card number",
    number: TEST_CARDS.unlisted,
    status: 400,
    code: "INVALID_CARD",
    error: "The card number is not valid.",
  },
  {
    name: "provider timeout",
    number: TEST_CARDS.providerTimeout,
    status: 504,
    code: "GATEWAY_TIMEOUT",
    error: "The payment provider did not respond. You have not been charged.",
  },
];

test.describe("Orders API", () => {
  test("requires a valid token to list orders and rejects unsupported methods", async ({
    api,
  }) => {
    const missingToken = await api.get("/api/shop/orders");
    expect(missingToken.status()).toBe(401);
    expect(await missingToken.json()).toMatchObject({
      error: "Missing or invalid bearer token",
    });

    const invalidToken = await api.get("/api/shop/orders", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(invalidToken.status()).toBe(401);

    const headers = await loginHeaders(api);
    const wrongMethod = await api.put("/api/shop/orders", {
      headers,
      data: {},
    });
    expect(wrongMethod.status()).toBe(405);
    expect(await wrongMethod.json()).toMatchObject({
      error: "Method not allowed. Use GET, POST.",
    });
  });

  test("returns not found for unknown order reads and cancellations", async ({
    api,
  }) => {
    const headers = await loginHeaders(api);

    const missingOrder = await api.get("/api/shop/orders/no-such-qa-order", {
      headers,
    });
    expect(missingOrder.status()).toBe(404);

    const missingCancellation = await api.post(
      "/api/shop/orders/no-such-qa-order/cancel",
      { headers },
    );
    expect(missingCancellation.status()).toBe(404);
  });

  test("rejects missing cart, empty cart, and invalid order details", async ({
    api,
  }) => {
    const headers = await loginHeaders(api);
    const missingCart = await api.post("/api/shop/orders", {
      headers: { Authorization: headers.Authorization },
      data: buildOrderPayload(`qa-${randomUUID()}@example.test`),
    });
    expect(missingCart.status()).toBe(400);
    expect(await missingCart.json()).toMatchObject({
      error:
        "The X-Shop-Cart header is required (8–64 letters, digits, - or _)",
    });

    const emptyCartHeaders = await loginHeaders(api);
    const emptyCart = await api.post("/api/shop/orders", {
      headers: emptyCartHeaders,
      data: buildOrderPayload(`qa-${randomUUID()}@example.test`),
    });
    expect(emptyCart.status()).toBe(400);
    expect(await emptyCart.json()).toMatchObject({
      code: "EMPTY_CART",
      error: "Your cart is empty.",
    });

    const invalidHeaders = await loginHeaders(api);
    await addItemToCart(api, invalidHeaders);

    const emptyBody = await api.post("/api/shop/orders", {
      headers: invalidHeaders,
      data: {},
    });
    expect(emptyBody.status()).toBe(400);
    expect(await emptyBody.json()).toMatchObject({
      error: "email must be a valid email address",
    });

    const invalidEmail = buildOrderPayload("not-an-email");
    const missingName = buildOrderPayload(`qa-${randomUUID()}@example.test`);
    missingName.address.fullName = "";
    const missingStreet = buildOrderPayload(`qa-${randomUUID()}@example.test`);
    missingStreet.address.street = "";
    const missingCity = buildOrderPayload(`qa-${randomUUID()}@example.test`);
    missingCity.address.city = "";
    const missingPostcode = buildOrderPayload(
      `qa-${randomUUID()}@example.test`,
    );
    missingPostcode.address.postcode = "";
    const missingCountry = buildOrderPayload(`qa-${randomUUID()}@example.test`);
    missingCountry.address.country = "";
    const invalidDelivery = buildOrderPayload(
      `qa-${randomUUID()}@example.test`,
    );
    invalidDelivery.delivery = "overnight";
    const invalidCard = buildOrderPayload(`qa-${randomUUID()}@example.test`, {
      cardNumber: TEST_CARDS.invalid,
    });
    const invalidExpiry = buildOrderPayload(`qa-${randomUUID()}@example.test`);
    invalidExpiry.card.expiry = "x";
    const invalidCvc = buildOrderPayload(`qa-${randomUUID()}@example.test`);
    invalidCvc.card.cvc = "x";

    const invalidRequests = [
      {
        request: invalidEmail,
        error: "email must be a valid email address",
      },
      {
        request: missingName,
        error: "address.fullName is required",
      },
      {
        request: missingStreet,
        error: "address.street is required",
      },
      {
        request: missingCity,
        error: "address.city is required",
      },
      {
        request: missingPostcode,
        error: "address.postcode is required",
      },
      {
        request: missingCountry,
        error: "address.country is required",
      },
      {
        request: invalidDelivery,
        error: "delivery must be standard, express or pickup",
      },
      {
        request: invalidCard,
        error: "The card number is not valid.",
        code: "INVALID_CARD",
      },
      {
        request: invalidExpiry,
        error: "The expiry date is not valid.",
        code: "INVALID_EXPIRY",
      },
      {
        request: invalidCvc,
        error: "The CVC must be 3 digits.",
        code: "INVALID_CVC",
      },
    ];

    for (const invalid of invalidRequests) {
      const response = await api.post("/api/shop/orders", {
        headers: invalidHeaders,
        data: invalid.request,
      });
      expect(response.status()).toBe(400);
      expect(await response.json()).toMatchObject({
        error: invalid.error,
        ...(invalid.code ? { code: invalid.code } : {}),
      });
      await expectNoOrderForEmail(
        api,
        invalid.request.email,
        invalidHeaders,
        invalid.request.email !== "not-an-email",
      );
    }
  });

  test("accepts each documented delivery choice before payment", async ({
    api,
  }) => {
    for (const delivery of ORDER_DELIVERY_OPTIONS) {
      const headers = await loginHeaders(api);
      const email = `qa-${randomUUID()}@example.test`;
      await addItemToCart(api, headers);
      const data = buildOrderPayload(email, {
        cardNumber: TEST_CARDS.declined,
        delivery,
      });

      const response = await api.post("/api/shop/orders", {
        headers,
        data,
      });
      expect(response.status()).toBe(402);
      expect(await response.json()).toMatchObject({
        code: "CARD_DECLINED",
      });
      await expectNoOrderForEmail(api, email, headers);
    }
  });

  for (const failure of failedPayments) {
    // Assertions for each generated test are inside the shared verifier.
    // eslint-disable-next-line playwright/expect-expect
    test(`rejects ${failure.name} without creating an order`, async ({
      api,
    }) => {
      await expectPaymentFailure(api, failure);
    });
  }

  test("requires 3-D Secure approval and rejects a declined authentication", async ({
    api,
  }) => {
    const headers = await loginHeaders(api);
    const email = `qa-${randomUUID()}@example.test`;
    await addItemToCart(api, headers);
    const payload = buildOrderPayload(email, {
      cardNumber: TEST_CARDS.threeDS,
    });

    const challenge = await api.post("/api/shop/orders", {
      headers,
      data: payload,
    });
    expect(challenge.status()).toBe(402);
    expect(await challenge.json()).toMatchObject({
      code: "REQUIRES_3DS",
      error: "Your bank needs to confirm this payment.",
    });

    const rejected = await api.post("/api/shop/orders", {
      headers,
      data: buildOrderPayload(email, {
        cardNumber: TEST_CARDS.threeDS,
        threeDS: "rejected",
      }),
    });
    expect(rejected.status()).toBe(402);
    expect(await rejected.json()).toMatchObject({
      code: "AUTHENTICATION_FAILED",
      error: "Your bank rejected the payment.",
    });

    await expectNoOrderForEmail(api, email, headers);
  });

  test("[@mutating] creates, lists, reads, cancels, and emails an order", async ({
    api,
  }) => {
    // Order creation changes the shared demo; routine runs must remain read-only.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_MUTATING_TESTS !== "true",
      "Creates a Shop test account and simulated order; set RUN_MUTATING_TESTS=true to run.",
    );

    const headers = await loginHeaders(api);
    const email = `qa-${randomUUID()}@example.test`;
    await addItemToCart(api, headers);

    let orderId: string | undefined;
    try {
      const ordersApi = new OrdersApi(api);
      const inboxApi = new InboxApi(api);
      const cartBeforeOrder = await api.get(
        "/api/shop/cart?delivery=standard",
        { headers },
      );
      expect(cartBeforeOrder.status()).toBe(200);
      const cart = (await cartBeforeOrder.json()) as { totalCents: number };

      const created = await ordersApi.create(headers, buildOrderPayload(email));
      expect(created.status()).toBe(201);
      const createdOrder = (await created.json()) as {
        id: string;
        email: string;
        status: string;
        totalCents: number;
      };
      orderId = createdOrder.id;
      expect(createdOrder).toMatchObject({
        id: expect.stringMatching(/^QE-/),
        email,
        status: "Processing",
        totalCents: cart.totalCents,
      });

      const cartAfterOrder = await api.get("/api/shop/cart", { headers });
      expect(cartAfterOrder.status()).toBe(200);
      expect(await cartAfterOrder.json()).toMatchObject({
        items: [],
        totalCents: 0,
      });

      const otherAccount = await api.post("/api/shop/register", {
        data: {
          name: "QA Other Account",
          email: `qa-other-${randomUUID()}@example.test`,
          password: "Password1",
        },
      });
      expect(otherAccount.status()).toBe(201);
      const { token: otherToken } = (await otherAccount.json()) as {
        token: string;
      };
      const otherHeaders = { Authorization: `Bearer ${otherToken}` };

      const otherOrders = await ordersApi.list(otherHeaders);
      expect(otherOrders.status()).toBe(200);
      expect((await otherOrders.json()).orders).not.toContainEqual(
        expect.objectContaining({ id: orderId }),
      );

      const otherRead = await ordersApi.get(orderId, otherHeaders);
      expect(otherRead.status()).toBe(404);
      const otherCancel = await ordersApi.cancel(orderId, otherHeaders);
      expect(otherCancel.status()).toBe(404);

      const anonymousRead = await ordersApi.get(orderId);
      expect(anonymousRead.status()).toBe(404);
      const anonymousCancel = await ordersApi.cancel(orderId);
      expect(anonymousCancel.status()).toBe(404);

      const listed = await ordersApi.list(headers);
      expect(listed.status()).toBe(200);
      expect((await listed.json()).orders).toContainEqual(
        expect.objectContaining({ id: orderId, email }),
      );

      const fetched = await ordersApi.get(orderId, headers);
      expect(fetched.status()).toBe(200);
      expect(await fetched.json()).toMatchObject({
        id: orderId,
        email,
        status: "Processing",
        address: { fullName: "QA Automation" },
        cardLast4: "1111",
      });

      await inboxApi.expectMessage(email, {
        id: orderId,
        subject: `Your order ${orderId} is confirmed`,
        totalCents: createdOrder.totalCents,
        receivedAt: expect.any(String),
      });

      const cancelled = await ordersApi.cancel(orderId, headers);
      expect(cancelled.status()).toBe(200);
      orderId = undefined;
      expect(await cancelled.json()).toMatchObject({
        id: createdOrder.id,
        cancelled: true,
        status: "Cancelled",
      });

      const repeatedCancellation = await ordersApi.cancel(
        createdOrder.id,
        headers,
      );
      expect(repeatedCancellation.status()).toBe(409);
      expect(await repeatedCancellation.json()).toMatchObject({
        code: "NOT_CANCELLABLE",
      });

      const afterCancellation = await ordersApi.get(createdOrder.id, headers);
      expect(afterCancellation.status()).toBe(200);
      expect((await afterCancellation.json()).status).toBe("Cancelled");

      const listedAfterCancellation = await ordersApi.list(headers);
      expect(listedAfterCancellation.status()).toBe(200);
      expect((await listedAfterCancellation.json()).orders).toContainEqual(
        expect.objectContaining({ id: createdOrder.id, status: "Cancelled" }),
      );

      await inboxApi.expectMessage(email, {
        id: createdOrder.id,
        subject: `Your order ${createdOrder.id} is confirmed`,
      });
    } finally {
      // If an assertion fails before cancellation, clean up while still cancellable.
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (orderId) {
        const cleanup = await new OrdersApi(api).cancel(orderId, headers);
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(cleanup.status()).toBe(200);
      }
    }
  });

  test("[@mutating] approves a 3-D Secure payment and cancels the order", async ({
    api,
  }) => {
    // A successful payment creates a simulated order in the shared demo.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_MUTATING_TESTS !== "true",
      "Creates a simulated order; set RUN_MUTATING_TESTS=true to run.",
    );

    const headers = await loginHeaders(api);
    const email = `qa-${randomUUID()}@example.test`;
    await addItemToCart(api, headers);

    let orderId: string | undefined;
    try {
      const ordersApi = new OrdersApi(api);
      const approved = await ordersApi.create(
        headers,
        buildOrderPayload(email, {
          cardNumber: TEST_CARDS.threeDS,
          threeDS: "approved",
        }),
      );
      expect(approved.status()).toBe(201);
      const order = (await approved.json()) as {
        id: string;
        status: string;
        cardLast4: string;
      };
      orderId = order.id;
      expect(order).toMatchObject({
        id: expect.stringMatching(/^QE-/),
        status: "Processing",
        cardLast4: "3220",
      });

      const cancelled = await ordersApi.cancel(orderId, headers);
      expect(cancelled.status()).toBe(200);
      orderId = undefined;
      expect((await cancelled.json()).status).toBe("Cancelled");
    } finally {
      // If an assertion fails before cancellation, clean up while still cancellable.
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (orderId) {
        const cleanup = await new OrdersApi(api).cancel(orderId, headers);
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(cleanup.status()).toBe(200);
      }
    }
  });

  test("[@mutating] rejects cancellation after an order ships", async ({
    api,
  }) => {
    // This order becomes Shipped automatically and cannot be cancelled afterward.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_MUTATING_TESTS !== "true",
      "Creates a simulated order that ships; set RUN_MUTATING_TESTS=true to run.",
    );
    test.setTimeout(45_000);

    const headers = await loginHeaders(api);
    const email = `qa-${randomUUID()}@example.test`;
    await addItemToCart(api, headers);

    let orderId: string | undefined;
    try {
      const created = await new OrdersApi(api).create(
        headers,
        buildOrderPayload(email),
      );
      expect(created.status()).toBe(201);
      const order = (await created.json()) as { id: string; status: string };
      orderId = order.id;
      expect(order.status).toBe("Processing");

      await expect
        .poll(
          async () => {
            const current = await new OrdersApi(api).get(order.id, headers);
            expect(current.status()).toBe(200);
            return (await current.json()).status;
          },
          { timeout: 30_000 },
        )
        .toBe("Shipped");

      const cancellation = await new OrdersApi(api).cancel(order.id, headers);
      expect(cancellation.status()).toBe(409);
      expect(await cancellation.json()).toMatchObject({
        code: "NOT_CANCELLABLE",
        error: "This order can no longer be cancelled.",
      });
      orderId = undefined;
    } finally {
      // A still-processing order is cleaned up if the shipment assertion fails.
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (orderId) {
        await cancelIfProcessing(api, orderId, headers);
      }
    }
  });

  test("validates the inbox email query", async ({ api }) => {
    const missingEmail = await api.get("/api/shop/inbox");
    expect(missingEmail.status()).toBe(400);
    expect(await missingEmail.json()).toMatchObject({
      error: "email must be a valid email address",
    });

    const invalidEmail = await api.get("/api/shop/inbox?email=not-an-email");
    expect(invalidEmail.status()).toBe(400);
    expect(await invalidEmail.json()).toMatchObject({
      error: "email must be a valid email address",
    });

    const unusedEmail = await api.get(
      `/api/shop/inbox?email=${encodeURIComponent(`qa-${randomUUID()}@example.test`)}`,
    );
    expect(unusedEmail.status()).toBe(200);
    expect((await unusedEmail.json()).messages).toEqual([]);
  });
});
