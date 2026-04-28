import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bundle splitting", () => {
  it("loads the authenticated dashboard through a lazy chunk", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

    expect(appSource).toContain(
      'lazy(() => import("./components/AuthenticatedDashboardApp"))'
    );
    expect(appSource).not.toContain(
      'from "./components/AuthenticatedDashboardApp"'
    );
  });

  it("defers dashboard service modules behind dynamic imports", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const deferredModules = [
      "bookmark-assets",
      "bookmark-extract",
      "bookmarks",
      "extension-presence",
      "extension-tokens",
      "folders",
      "recommendations",
      "session",
      "tags"
    ];
    const importDeclarations = dashboardSource.match(/import[\s\S]*?;\r?\n/g) ?? [];

    for (const moduleName of deferredModules) {
      expect(
        importDeclarations.filter(
          (statement) =>
            statement.includes(`from "../lib/${moduleName}"`) &&
            !statement.startsWith("import type")
        )
      ).toEqual([]);
      expect(dashboardSource).toContain(
        `import("../lib/${moduleName}")`
      );
    }
  });
});
