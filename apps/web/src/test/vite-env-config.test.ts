import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";

describe("vite env config", () => {
  it("loads Firebase client env from the repository root during web builds", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const loadedConfig = await loadConfigFromFile(
      { command: "build", mode: "production" },
      resolve(process.cwd(), "vite.config.ts")
    );

    expect(resolve(loadedConfig?.config.envDir ?? "")).toBe(repositoryRoot);
  });
});
