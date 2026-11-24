import { randomUUID } from "node:crypto";
import { expect, test } from "../fixtures/api";

type User = {
  id: number;
  firstName: string;
  lastName: string;
  role: "Admin" | "Manager" | "User";
};

test.describe("Users API", () => {
  test("lists users and filters by supported role", async ({ api }) => {
    const response = await api.get("/api/users");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { users: User[] };
    expect(body.users.length).toBeGreaterThan(0);

    for (const role of ["Admin", "Manager", "User"] as const) {
      const filtered = await api.get(`/api/users?role=${role}`);
      expect(filtered.status()).toBe(200);
      const filteredBody = (await filtered.json()) as { users: User[] };
      expect(filteredBody.users.length).toBeGreaterThan(0);
      expect(filteredBody.users.every((user) => user.role === role)).toBe(true);
    }
  });

  test("returns users by numeric ID and rejects invalid or missing IDs", async ({
    api,
  }) => {
    const existing = await api.get("/api/users/1");
    expect(existing.status()).toBe(200);
    expect((await existing.json()).id).toBe(1);

    expect((await api.get("/api/users/not-a-number")).status()).toBe(400);
    expect((await api.get("/api/users/999999999")).status()).toBe(404);
  });

  test("creates, replaces, patches, and deletes an isolated user", async ({
    api,
  }) => {
    const nonce = randomUUID().replace(/-/g, "").slice(0, 10);
    const createdUser = {
      firstName: `QA${nonce}`,
      lastName: "Automation",
      role: "User",
    };
    let userId: number | undefined;

    try {
      const created = await api.post("/api/users", { data: createdUser });
      expect(created.status()).toBe(201);
      expect(created.headers().location).toBeTruthy();
      const createdBody = (await created.json()) as User;
      userId = createdBody.id;
      expect(Number.isInteger(userId)).toBe(true);

      const fetched = await api.get(`/api/users/${userId}`);
      expect(fetched.status()).toBe(200);
      expect((await fetched.json()).firstName).toBe(createdUser.firstName);

      const replacement = {
        firstName: `PUT${nonce}`,
        lastName: "Replaced",
        role: "Manager",
      };
      const replaced = await api.put(`/api/users/${userId}`, {
        data: replacement,
      });
      expect(replaced.status()).toBe(200);
      expect(await replaced.json()).toMatchObject(replacement);

      const patched = await api.patch(`/api/users/${userId}`, {
        data: { lastName: "Patched" },
      });
      expect(patched.status()).toBe(200);
      expect(await patched.json()).toMatchObject({
        firstName: replacement.firstName,
        lastName: "Patched",
        role: "Manager",
      });

      const deleted = await api.delete(`/api/users/${userId}`);
      expect(deleted.status()).toBe(204);
      userId = undefined;
      expect((await api.get(`/api/users/${createdBody.id}`)).status()).toBe(
        404,
      );
    } finally {
      // The user may not exist if setup failed before creation.
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (userId !== undefined) {
        const cleanup = await api.delete(`/api/users/${userId}`);
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(cleanup.status()).toBe(204);
      }
    }
  });

  test("rejects missing fields and unsupported roles without creating users", async ({
    api,
  }) => {
    const missingFields = await api.post("/api/users", {
      data: { firstName: "QA", lastName: "Automation" },
    });
    expect(missingFields.status()).toBe(400);

    const unsupportedRole = await api.post("/api/users", {
      data: { firstName: "QA", lastName: "Automation", role: "Owner" },
    });
    expect(unsupportedRole.status()).toBe(400);
  });

  test("returns not found when updating or deleting an unknown user", async ({
    api,
  }) => {
    const id = "999999999";
    expect(
      (
        await api.put(`/api/users/${id}`, {
          data: { firstName: "QA", lastName: "Automation", role: "User" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await api.patch(`/api/users/${id}`, {
          data: { lastName: "Automation" },
        })
      ).status(),
    ).toBe(404);
    expect((await api.delete(`/api/users/${id}`)).status()).toBe(404);
  });
});
