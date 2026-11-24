import { request, test as base, type APIRequestContext } from '@playwright/test';

type ApiFixtures = {
  api: APIRequestContext;
};

export const test = base.extend<ApiFixtures>({
  api: async ({}, use) => {
    const api = await request.newContext({
      baseURL:
        process.env.API_BASE_URL ??
        process.env.APP_BASE_URL ??
        'https://playwright-playground.com',
    });

    await use(api);
    await api.dispose();
  },
});

export { expect } from '@playwright/test';
