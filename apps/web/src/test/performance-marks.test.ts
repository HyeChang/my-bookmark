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

  it("instruments dashboard data refresh and panel chunk preloads", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const performanceSource = readFileSync(
      join(process.cwd(), "src", "lib", "performance-marks.ts"),
      "utf8"
    );

    expect(performanceSource).toContain("export async function measureAsyncPerformance");
    expect(dashboardSource).toContain(
      'import { measureAsyncPerformance } from "../lib/performance-marks";'
    );
    expect(dashboardSource).toContain('measureAsyncPerformance("dashboard:data-refresh"');
    expect(dashboardSource).toContain("measureAsyncPerformance(`dashboard:panel-preload:${chunk}`");
  });
});
