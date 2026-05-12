import type { BookmarkViewMode } from "./BookmarkResultsPanel";

export const BOOKMARK_VIRTUALIZATION_THRESHOLD = 60;
export const BOOKMARK_VIRTUAL_WINDOW_SIZE = 40;
export const BOOKMARK_VIRTUAL_MOBILE_WINDOW_SIZE = 28;
export const BOOKMARK_VIRTUAL_OVERSCAN = 8;

const bookmarkVirtualRowHeightByMode: Record<BookmarkViewMode, number> = {
  list: 112,
  title: 76,
  card: 260,
  moodboard: 320
};

export type BookmarkVirtualWindowOptions = {
  bookmarkViewMode: BookmarkViewMode;
  itemCount: number;
  requestedStart: number;
  shouldUseCompactMobileCards: boolean;
};

export function getBookmarkVirtualWindow({
  bookmarkViewMode,
  itemCount,
  requestedStart,
  shouldUseCompactMobileCards
}: BookmarkVirtualWindowOptions) {
  const canVirtualize =
    (bookmarkViewMode === "list" || bookmarkViewMode === "title") &&
    itemCount > BOOKMARK_VIRTUALIZATION_THRESHOLD;
  const windowSize = shouldUseCompactMobileCards
    ? BOOKMARK_VIRTUAL_MOBILE_WINDOW_SIZE
    : BOOKMARK_VIRTUAL_WINDOW_SIZE;
  const rowHeight = bookmarkVirtualRowHeightByMode[bookmarkViewMode];
  const windowStartMax = Math.max(0, itemCount - windowSize);
  const windowStart = canVirtualize
    ? Math.min(Math.max(0, requestedStart), windowStartMax)
    : 0;
  const windowEnd = canVirtualize
    ? Math.min(itemCount, windowStart + windowSize)
    : itemCount;

  return {
    canVirtualize,
    rowHeight,
    windowSize,
    windowStartMax,
    windowStart,
    windowEnd,
    topSpacerHeight: canVirtualize ? windowStart * rowHeight : 0,
    bottomSpacerHeight: canVirtualize
      ? Math.max(0, itemCount - windowEnd) * rowHeight
      : 0
  };
}

export function getBookmarkVirtualWindowStartForScroll({
  listTop,
  rowHeight,
  startMax
}: {
  listTop: number;
  rowHeight: number;
  startMax: number;
}) {
  const scrolledPastListTop = Math.max(0, -listTop);
  return Math.max(
    0,
    Math.min(
      startMax,
      Math.floor(scrolledPastListTop / rowHeight) - BOOKMARK_VIRTUAL_OVERSCAN
    )
  );
}
