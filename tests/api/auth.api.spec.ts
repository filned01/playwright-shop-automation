import { randomUUID } from "node:crypto";
import { expect, test } from "../fixtures/api";

test.describe("Authentication API", () => {
  test("requires a bearer token and accepts the published demo login", async ({
    api,
  }) => {
    expect((await api.get("/api/me")).status()).toBe(401);

    const invalidToken = await api.get("/api/me", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(invalidToken.status()).toBe(401);
    expect(await invalidToken.json()).toMatchObject({
      error: "Missing or invalid bearer token",
    });

    const badLogin = await api.post("/api/auth/login", {
      data: {
        username: `unknown-${randomUUID()}`,
        password: "invalid-password",
      },
    });
    expect(badLogin.status()).toBe(401);

    const login = await api.post("/api/auth/login", {
      data: { username: "TedBuckland", password: "Alligator3" },
    });
    expect(login.status()).toBe(200);
    const token = (await login.json()).token as string;
    expect(token.length).toBeGreaterThan(0);

    const profile = await api.get("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profile.status()).toBe(200);
    expect(await profile.json()).toMatchObject({
      username: "TedBuckland",
      role: expect.any(String),
    });
  });
});
