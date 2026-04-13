import { describe, expect, it } from "vitest";

import { toDisplayBookmark } from "../../src/lib/repositories/bookmarks";

describe("toDisplayBookmark", () => {
  it("prefers user fields over source fields", () => {
    const bookmark = toDisplayBookmark({
      id: "bookmark-1",
      user_title: "Manual title",
      source_title: "Source title",
      user_content: "Manual content",
      source_content: "Source content",
      user_summary: "Manual summary",
      source_summary: "Source summary"
    });

    expect(bookmark.displayTitle).toBe("Manual title");
    expect(bookmark.displayContent).toBe("Manual content");
    expect(bookmark.displaySummary).toBe("Manual summary");
  });

  it("falls back to source fields when user fields are empty", () => {
    const bookmark = toDisplayBookmark({
      id: "bookmark-2",
      user_title: null,
      source_title: "Source title",
      user_content: null,
      source_content: "Source content",
      user_summary: null,
      source_summary: "Source summary"
    });

    expect(bookmark.displayTitle).toBe("Source title");
    expect(bookmark.displayContent).toBe("Source content");
    expect(bookmark.displaySummary).toBe("Source summary");
  });
});
