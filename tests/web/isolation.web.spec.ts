import { expect, test } from "@playwright/test";

test.describe("Browser context isolation", () => {
  test("keeps carts isolated between browser contexts", async ({ browser }) => {
    const baseURL =
      process.env.APP_BASE_URL ?? "https://playwright-playground.com";
    const first = await browser.newContext({ baseURL });
    const second = await browser.newContext({ baseURL });
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();

    try {
      await firstPage.goto("/shop/product/compact-hd-tv");
      await firstPage.getByRole("button", { name: "Add to cart" }).click();
      await secondPage.goto("/shop/product/wireless-mouse");
      await secondPage.getByRole("button", { name: "Add to cart" }).click();

      await firstPage.goto("/shop/cart");
      await secondPage.goto("/shop/cart");

      await expect(firstPage.getByText("Compact HD TV")).toBeVisible();
      await expect(firstPage.getByText("Wireless Mouse")).toHaveCount(0);
      await expect(secondPage.getByText("Wireless Mouse")).toBeVisible();
      await expect(secondPage.getByText("Compact HD TV")).toHaveCount(0);
    } finally {
      await first.close();
      await second.close();
    }
  });
});
