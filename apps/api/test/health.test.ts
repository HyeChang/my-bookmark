import { describe, expect, it } from "vitest";

import app from "../src/index";

describe("health route", () => {
  it("returns ok payload", async () => {
    const res = await app.request("http://example.com/api/health");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
