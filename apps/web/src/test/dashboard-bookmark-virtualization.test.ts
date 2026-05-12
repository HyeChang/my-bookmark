import { describe, expect, it } from "vitest";

import {
  getBookmarkVirtualWindow,
  getBookmarkVirtualWindowStartForScroll
} from "../components/dashboard-bookmark-virtualization";

describe("dashboard bookmark virtualization", () => {
  it("calculates a bounded list virtual window and spacer heights", () => {
    const windowState = getBookmarkVirtualWindow({
      bookmarkViewMode: "list",
      itemCount: 120,
      requestedStart: 18,
      shouldUseCompactMobileCards: false
    });

    expect(windowState).toMatchObject({
      canVirtualize: true,
      rowHeight: 112,
      windowSize: 40,
      windowStart: 18,
      windowEnd: 58,
      topSpacerHeight: 2016,
      bottomSpacerHeight: 6944
    });
  });

  it("keeps card and small result sets unvirtualized", () => {
    expect(
      getBookmarkVirtualWindow({
        bookmarkViewMode: "card",
        itemCount: 120,
        requestedStart: 30,
        shouldUseCompactMobileCards: false
      })
    ).toMatchObject({
      canVirtualize: false,
      windowStart: 0,
      windowEnd: 120,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0
    });

    expect(
      getBookmarkVirtualWindow({
        bookmarkViewMode: "list",
        itemCount: 20,
        requestedStart: 10,
        shouldUseCompactMobileCards: false
      }).canVirtualize
    ).toBe(false);
  });

  it("derives the next virtual window start from the list scroll position", () => {
    expect(
      getBookmarkVirtualWindowStartForScroll({
        listTop: -1300,
        rowHeight: 112,
        startMax: 80
      })
    ).toBe(3);

    expect(
      getBookmarkVirtualWindowStartForScroll({
        listTop: -100_000,
        rowHeight: 112,
        startMax: 80
      })
    ).toBe(80);
  });
});
