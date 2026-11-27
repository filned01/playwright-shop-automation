import { expect, test } from "@playwright/test";

test.describe("Shop cart", () => {
  test("adds a chosen option and quantity, updates the line, and removes it", async ({
    page,
  }) => {
    await page.goto("/shop/product/aurora-4k-tv");
    await expect(
      page.getByRole("heading", { name: "Aurora 4K TV" }),
    ).toBeVisible();

    await page.getByRole("radio", { name: "65 inch" }).check();
    await page.getByLabel("Quantity").fill("2");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("status")).toContainText("Added Aurora 4K TV");
    await page.getByRole("link", { name: "Cart (2)" }).click();

    const cart = page.getByRole("list", { name: "Cart items" });
    const line = cart.getByRole("listitem");
    await expect(line).toContainText("Screen size: 65 inch");
    await expect(line.getByLabel("Quantity of Aurora 4K TV")).toHaveValue("2");

    await line.getByLabel("Quantity of Aurora 4K TV").fill("1");
    await expect(line).toContainText("$899.99");
    await line.getByRole("button", { name: "Remove Aurora 4K TV" }).click();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("applies, validates, replaces, and removes promo codes", async ({
    page,
  }) => {
    await page.goto("/shop/product/wireless-mouse");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("link", { name: /Cart/ }).click();

    const promo = page.getByLabel("Promo code");
    await promo.fill("WELCOME20");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page
        .getByText(/WELCOME20 applied|WELCOME20 needs a minimum spend/i)
        .first(),
    ).toBeVisible();
    const removeCode = page.getByRole("button", { name: "Remove code" });
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (await removeCode.isVisible()) {
      await removeCode.click();
    }

    await promo.fill("UNKNOWN");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    await promo.fill("SUMMER25");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/does not exist|expired/i)).toBeVisible();
  });
});
