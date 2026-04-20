import { describe, expect, it } from "vitest";

import { extractBookmarkPreviewFromHtml } from "../src/lib/extract/bookmark-extractor";

describe("bookmark extractor", () => {
  it("keeps full extracted article text instead of replacing the tail with an ellipsis", () => {
    const paragraphs = Array.from({ length: 90 }, (_, index) => {
      return `<p>Paragraph ${index + 1} includes enough text to represent a saved article section.</p>`;
    }).join("");
    const preview = extractBookmarkPreviewFromHtml(
      "https://example.com/long-article",
      `<html><head><title>Long article</title></head><body><article>${paragraphs}</article></body></html>`
    );

    expect(preview.sourceContent).toContain("Paragraph 90");
    expect(preview.sourceContent).not.toMatch(/\.\.\.$/);
  });
});
