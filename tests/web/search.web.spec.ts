import { expect, test } from "@playwright/test";

test.describe("Shop search", () => {
  test("returns matching products and handles no results", async ({ page }) => {
    await page.goto("/shop");
    const search = page.getByRole("searchbox", { name: "Search products" });
    const products = page.getByRole("list", { name: "Products" });

    await search.fill("Aurora");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(products.getByRole("listitem")).toHaveCount(2);
    await expect(products.getByText("Aurora 4K TV")).toBeVisible();
    await expect(products.getByText("Aurora OLED TV")).toBeVisible();

    await search.fill("no-such-qa-product");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(products.getByRole("listitem")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("0 products");
  });
});
