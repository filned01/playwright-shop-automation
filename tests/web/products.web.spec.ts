import { expect, test } from "@playwright/test";

test.describe("Product catalog and details", () => {
  test("browses catalog, sorts products, and paginates", async ({ page }) => {
    await page.goto("/shop");
    await expect(
      page.getByRole("heading", { name: "All products" }),
    ).toBeVisible();
    const products = page.getByRole("list", { name: "Products" });
    await expect(products.getByRole("listitem").first()).toBeVisible();

    await page
      .getByLabel("Sort by")
      .selectOption({ label: "Price: low to high" });
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(products.getByRole("listitem").first()).toContainText(
      "Wireless Mouse",
    );
    const prices = await products.getByRole("listitem").evaluateAll((cards) =>
      cards.map((card) => {
        const amount = card.textContent?.match(/\$([\d,]+\.\d{2})/)?.[1];
        return amount ? Number(amount.replace(/,/g, "")) : Number.NaN;
      }),
    );
    expect(prices.length).toBeGreaterThan(1);
    expect(prices.every(Number.isFinite)).toBe(true);
    expect(prices).toEqual([...prices].sort((left, right) => left - right));

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Page 3 of 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("Page 2 of 3")).toBeVisible();

    await page.getByRole("link", { name: "TVs" }).click();
    await expect(page).toHaveURL(/category=tvs/);
    await expect(page.getByRole("status")).toContainText("products");
  });

  test("shows product specifications, reviews, options, and quantity", async ({
    page,
  }) => {
    await page.goto("/shop/product/aurora-4k-tv");
    await expect(
      page.getByRole("heading", { name: "Aurora 4K TV" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Specifications" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Reviews" })).toContainText(
      "4.0 out of 5",
    );

    await page.getByRole("radio", { name: "65 inch" }).check();
    const quantity = page.getByLabel("Quantity");
    await quantity.fill("2");
    await expect(quantity).toHaveValue("2");
  });

  test("prevents adding a sold-out product", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });
});
