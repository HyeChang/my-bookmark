import { describe, expect, it } from "vitest";

import { createSessionValue, readSessionValue } from "../src/lib/auth/session";

const fakeUser = {
  uid: "firebase-user-1",
  email: "user@example.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

describe("session helpers", () => {
  it("creates and reads a session without relying on Buffer", async () => {
    const originalBuffer = Reflect.get(globalThis, "Buffer");
    Reflect.set(globalThis, "Buffer", undefined);

    try {
      const sessionValue = await createSessionValue(fakeUser, "dev-session-secret");
      await expect(
        readSessionValue(sessionValue, "dev-session-secret")
      ).resolves.toEqual(fakeUser);
    } finally {
      if (originalBuffer === undefined) {
        Reflect.deleteProperty(globalThis, "Buffer");
      } else {
        Reflect.set(globalThis, "Buffer", originalBuffer);
      }
    }
  });
});
