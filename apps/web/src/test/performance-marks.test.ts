import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("dashboard performance marks", () => {
  it("records and clears async performance measures", async () => {
    const marks: string[] = [];
    const measures: Array<{ name: string; start: string; end: string }> = [];
    const clearedMarks: string[] = [];

    vi.stubGlobal("performance", {
      mark: vi.fn((name: string) => {
        marks.push(name);
      }),
      measure: vi.fn((name: string, start: string, end: string) => {
        measures.push({ name, start, end });
      }),
      clearMarks: vi.fn((name: string) => {
        clearedMarks.push(name);
      })
    });

    const { measureAsyncPerformance } = await import("../lib/performance-marks");
    const result = await measureAsyncPerformance("dashboard:data-refresh", async () => "done");

    expect(result).toBe("done");
    expect(marks).toHaveLength(2);
    expect(measures).toEqual([
      {
        name: "bookmark:dashboard:data-refresh",
        start: marks[0],
        end: marks[1]
      }
    ]);
    expect(clearedMarks).toEqual(marks);
  });

  it("records and clears sync performance measures", async () => {
    const marks: string[] = [];
    const measures: Array<{ name: string; start: string; end: string }> = [];
    const clearedMarks: string[] = [];

    vi.stubGlobal("performance", {
      mark: vi.fn((name: string) => {
        marks.push(name);
      }),
      measure: vi.fn((name: string, start: string, end: string) => {
        measures.push({ name, start, end });
      }),
      clearMarks: vi.fn((name: string) => {
        clearedMarks.push(name);
      })
    });

    const { measureSyncPerformance } = await import("../lib/performance-marks");
    const result = measureSyncPerformance("dashboard:bookmark-list-view-models", () => "done");

    expect(result).toBe("done");
    expect(marks).toHaveLength(2);
    expect(measures).toEqual([
      {
        name: "bookmark:dashboard:bookmark-list-view-models",
        start: marks[0],
        end: marks[1]
      }
    ]);
    expect(clearedMarks).toEqual(marks);
  });

  it("instruments dashboard data refresh and panel/dialog chunk preloads", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
      "utf8"
    );
    const dashboardDialogChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-dialog-chunks.tsx"),
      "utf8"
    );
    const performanceSource = readFileSync(
      join(process.cwd(), "src", "lib", "performance-marks.ts"),
      "utf8"
    );

    expect(performanceSource).toContain("export async function measureAsyncPerformance");
    expect(performanceSource).toContain("export function measureSyncPerformance");
    expect(dashboardSource).toContain(
      'import { measureAsyncPerformance, measureSyncPerformance } from "../lib/performance-marks";'
    );
    expect(dashboardSource).toContain('measureAsyncPerformance("dashboard:data-refresh"');
    expect(dashboardSource).toContain('measureSyncPerformance("dashboard:bookmark-list-view-models"');
    expect(dashboardPanelChunksSource).toContain(
      'import { measureAsyncPerformance } from "../lib/performance-marks";'
    );
    expect(dashboardPanelChunksSource).toContain(
      "measureAsyncPerformance(`dashboard:panel-preload:${chunk}`"
    );
    expect(dashboardDialogChunksSource).toContain(
      'import { measureAsyncPerformance } from "../lib/performance-marks";'
    );
    expect(dashboardDialogChunksSource).toContain(
      "measureAsyncPerformance(`dashboard:dialog-preload:${chunk}`"
    );
  });

  it("starts lightweight real user monitoring from the app shell", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const rumSource = readFileSync(join(process.cwd(), "src", "lib", "rum.ts"), "utf8");

    expect(appSource).toContain('import { initRealUserMonitoring } from "./lib/rum";');
    expect(appSource).toContain("initRealUserMonitoring();");
    expect(rumSource).toContain("PerformanceObserver");
    expect(rumSource).toContain('import.meta.env.MODE === "test"');
    expect(rumSource).toContain("navigator.sendBeacon");
    expect(rumSource).toContain('fetch("/api/rum"');
    expect(rumSource).toContain('"largest-contentful-paint"');
    expect(rumSource).toContain('"layout-shift"');
    expect(rumSource).toContain('"navigation"');
    expect(rumSource).toContain('"measure"');
    expect(rumSource).toContain('"dashboard-data-refresh"');
    expect(rumSource).toContain('"dashboard-panel-preload"');
    expect(rumSource).toContain('"dashboard-dialog-preload"');
    expect(rumSource).toContain('"dashboard-bookmark-list-view-models"');
    expect(rumSource).toContain("bookmark:dashboard:panel-preload:");
    expect(rumSource).toContain("bookmark:dashboard:dialog-preload:");
    expect(rumSource).toContain("bookmark:dashboard:bookmark-list-view-models");
  });
});
