import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CSS budget", () => {
  it("keeps the main stylesheet below the source size budget", () => {
    const css = readFileSync(join(process.cwd(), "src", "App.css"));

    expect(css.byteLength).toBeLessThanOrEqual(152_000);
  });
});
