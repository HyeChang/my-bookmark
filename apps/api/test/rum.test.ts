import { describe, expect, it, vi } from "vitest";

import app from "../src/index";

describe("RUM route", () => {
  it("accepts anonymous non-PII performance metrics", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const res = await app.request("http://example.com/api/rum", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        metric: "largest-contentful-paint",
        value: 1234.5,
        rating: "good",
        navigation: "navigate"
      })
    });

    expect(res.status).toBe(204);
    expect(infoSpy).toHaveBeenCalledWith(
      "bookmark.rum",
      expect.stringContaining('"metric":"largest-contentful-paint"')
    );

    infoSpy.mockRestore();
  });

  it("rejects invalid performance metric payloads", async () => {
    const res = await app.request("http://example.com/api/rum", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        metric: "email",
        value: "private"
      })
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid RUM metric" });
  });
});
