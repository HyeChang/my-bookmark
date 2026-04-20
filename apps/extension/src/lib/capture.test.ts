import { describe, expect, it } from "vitest";

import { collectImageCandidates, normalizeSelectionText } from "./capture";

describe("extension capture helpers", () => {
  it("normalizes selected text into a readable single string", () => {
    expect(normalizeSelectionText("  first line\n\nsecond line   ")).toBe("first line\nsecond line");
  });

  it("deduplicates and filters image candidates", () => {
    expect(
      collectImageCandidates([
        "https://example.com/one.png",
        "",
        "data:image/png;base64,abc",
        "https://example.com/one.png",
        "https://example.com/two.jpg"
      ])
    ).toEqual(["https://example.com/one.png", "https://example.com/two.jpg"]);
  });
});
