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
        navigation: "navigate",
        detail: "home"
      })
    });

    expect(res.status).toBe(204);
    expect(infoSpy).toHaveBeenCalledWith(
      "bookmark.rum",
      expect.stringContaining('"metric":"largest-contentful-paint"')
    );

    infoSpy.mockRestore();
  });

  it("accepts controlled dashboard performance measures", async () => {
    const res = await app.request("http://example.com/api/rum", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        metric: "dashboard-panel-preload",
        value: 88.125,
        rating: "good",
        detail: "bookmarks"
      })
    });

    expect(res.status).toBe(204);
  });

  it("accepts bookmark list view model performance measures", async () => {
    const res = await app.request("http://example.com/api/rum", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        metric: "dashboard-bookmark-list-view-models",
        value: 42.25,
        rating: "good"
      })
    });

    expect(res.status).toBe(204);
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
