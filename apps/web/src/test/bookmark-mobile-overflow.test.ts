import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appCss = readFileSync(resolve(__dirname, "../App.css"), "utf8");

describe("bookmark mobile overflow css", () => {
  it("keeps long bookmark text from widening mobile bookmark rows", () => {
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-list-table,\s*\.bookmark-list-row,\s*\.bookmark-row-main,\s*\.bookmark-row-meta,\s*\.bookmark-row-summary,\s*\.bookmark-card-summary\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s
    );
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-row-summary,\s*\.bookmark-card-summary,\s*\.bookmark-row-meta-item\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/s
    );
  });
});
