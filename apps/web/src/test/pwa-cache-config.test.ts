import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("pwa cache config", () => {
  it("keeps generated app chunks out of the precache and caches them at runtime", () => {
    const viteConfigSource = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfigSource).toContain('globPatterns: ["index.html"');
    expect(viteConfigSource).not.toContain("**/*.{js,css,html,png,svg,webmanifest}");
    expect(viteConfigSource).toContain("runtimeCaching");
    expect(viteConfigSource).toContain("bookmark-runtime-assets");
    expect(viteConfigSource).toContain("urlPattern: /\\/assets\\/.*\\.(?:js|css)$/");
  });
});
