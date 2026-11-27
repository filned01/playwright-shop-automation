import { randomUUID } from "node:crypto";
import { test as base, type APIRequestContext } from "@playwright/test";
import { SHOP_DEMO_ACCOUNT } from "../constants";

export type ShopApiHeaders = {
  Authorization: string;
  "X-Shop-Cart": string;
};

export type ShopHeadersFactory = (cartId?: string) => Promise<ShopApiHeaders>;

type ApiFixtures = {
  api: APIRequestContext;
  shopHeaders: ShopHeadersFactory;
};

export const test = base.extend<ApiFixtures>({
  api: async ({ request }, use) => {
    await use(request);
  },
  shopHeaders: async ({ api }, use) => {
    const getHeaders: ShopHeadersFactory = async (
      cartId = `qa-${randomUUID()}`,
    ) => {
      const login = await api.post("/api/shop/login", {
        data: SHOP_DEMO_ACCOUNT,
      });
      if (login.status() !== 200) {
        throw new Error(
          `Shop login failed with status ${login.status()}: ${await login.text()}`,
        );
      }

      const body = (await login.json()) as { token?: string };
      if (!body.token) {
        throw new Error("Shop login response did not include a token.");
      }

      return {
        Authorization: `Bearer ${body.token}`,
        "X-Shop-Cart": cartId,
      };
    };

    await use(getHeaders);
  },
});

export { expect } from "@playwright/test";
