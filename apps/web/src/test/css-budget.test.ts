import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CSS budget", () => {
  it("keeps the initial app shell stylesheet small", () => {
    const css = readFileSync(join(process.cwd(), "src", "App.css"));

    expect(css.byteLength).toBeLessThanOrEqual(16_000);
    expect(css.toString("utf8")).not.toContain(".bookmark-list-table");
  });

  it("keeps the dashboard stylesheet below the source size budget", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css")
    );

    expect(css.byteLength).toBeLessThanOrEqual(152_000);
  });
});
