import { expect, type APIRequestContext } from "@playwright/test";

type InboxMessageMatcher = Record<string, unknown> & { id: string };

export class InboxApi {
  constructor(private readonly api: APIRequestContext) {}

  list(email?: string) {
    const path =
      email === undefined
        ? "/api/shop/inbox"
        : `/api/shop/inbox?email=${encodeURIComponent(email)}`;
    return this.api.get(path);
  }

  async expectMessage(
    email: string,
    expected: InboxMessageMatcher,
    timeout = 5_000,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          const response = await this.list(email);
          expect(response.status()).toBe(200);
          const body = (await response.json()) as {
            messages: Array<Record<string, unknown> & { id: string }>;
          };
          return body.messages.find((message) => message.id === expected.id);
        },
        { timeout },
      )
      .toMatchObject(expected);
  }
}
