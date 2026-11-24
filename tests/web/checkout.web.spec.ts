import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function addSimpleItemToCart(page: Page) {
  await page.goto("/shop/product/compact-hd-tv");
  await expect(
    page.getByRole("heading", { name: "Compact HD TV" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status")).toContainText("Added Compact HD TV");
}

async function continueAsGuestToPayment(page: Page, email: string) {
  await addSimpleItemToCart(page);
  await page.getByRole("link", { name: /Cart/ }).click();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByRole("button", { name: "Continue as guest" }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("QA Automation");
  await page.getByLabel("Street address").fill("1 Test Lane");
  await page.getByLabel("City").fill("Warsaw");
  await page.getByLabel("Postcode").fill("00-001");
  await page.getByLabel("Country").selectOption({ label: "Poland" });
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("region", { name: "Payment" })).toBeVisible();
}

async function fillTestCard(page: Page, number: string) {
  const paymentFrame = page.frameLocator("iframe");
  await paymentFrame.getByLabel("Card number").fill(number);
  await paymentFrame.getByLabel("Expiry date").fill("12/30");
  await paymentFrame.getByLabel("CVC").fill("123");
  await paymentFrame.getByLabel("Name on card").fill("QA Automation");
  await paymentFrame.getByRole("button", { name: /^Pay/ }).click();
}

function getOrderNumber(confirmation: string) {
  const orderNumber = confirmation.match(/QE-\d+/)?.[0];
  if (!orderNumber) {
    throw new Error(
      `Could not read the order number from the confirmation: ${confirmation}`,
    );
  }
  return orderNumber;
}

test.describe("Shop checkout and inbox", () => {
  test("requires valid delivery details before showing payment", async ({
    page,
  }) => {
    await addSimpleItemToCart(page);
    await page.getByRole("link", { name: /Cart/ }).click();
    await page.getByRole("link", { name: "Proceed to checkout" }).click();
    await page.getByRole("button", { name: "Continue as guest" }).click();

    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(
      page.getByRole("heading", { name: "Delivery details" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Payment" })).toHaveCount(0);
  });

  test("[@mutating] completes checkout with a test card and confirms the inbox message", async ({
    page,
  }) => {
    // Order creation is intentionally excluded from routine runs.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      process.env.RUN_MUTATING_TESTS !== "true",
      "Creates a simulated demo order; set RUN_MUTATING_TESTS=true to run.",
    );

    const email = `qa-${randomUUID()}@example.test`;
    await continueAsGuestToPayment(page, email);
    await expect(page.getByText("Test cards")).toBeVisible();

    await fillTestCard(page, "4111 1111 1111 1111");
    await expect(
      page.getByRole("heading", { name: "Thank you for your order!" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(
      page.getByText(/Paid with the card ending 1111/),
    ).toBeVisible();
    const confirmation = await page
      .getByRole("main")
      .getByRole("status")
      .innerText();
    const orderNumber = getOrderNumber(confirmation);

    await page.getByRole("link", { name: "Check your email" }).click();
    await expect(page).toHaveURL(/\/shop\/inbox\?email=/);
    await expect(
      page.getByText(`Your order ${orderNumber} is confirmed`),
    ).toBeVisible();
  });

  test("keeps checkout open when a demo card is declined", async ({ page }) => {
    const email = `qa-${randomUUID()}@example.test`;
    await continueAsGuestToPayment(page, email);
    await fillTestCard(page, "4000 0000 0000 0002");

    await expect(
      page.getByRole("heading", { name: "Thank you for your order!" }),
    ).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Payment" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("declined");
  });

  test("opens the demo inbox for an unused address", async ({ page }) => {
    await page.goto("/shop/inbox");
    await page
      .getByLabel("Email address")
      .fill(`qa-${randomUUID()}@example.test`);
    await page.getByRole("button", { name: "Open inbox" }).click();
    await expect(
      page.getByRole("heading", { name: "Email inbox (demo)" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/shop\/inbox/);
  });
});
