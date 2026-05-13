import type { BookmarkAsset } from "@bookmark/shared";

export type BookmarkImageLoadingPriority = {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low";
};

const EAGER_IMAGE_LOADING_PRIORITY: BookmarkImageLoadingPriority = {
  loading: "eager",
  fetchPriority: "high"
};

const LAZY_IMAGE_LOADING_PRIORITY: BookmarkImageLoadingPriority = {
  loading: "lazy",
  fetchPriority: "low"
};

const ABOVE_FOLD_BOOKMARK_LIST_IMAGE_COUNT = 4;
const ABOVE_FOLD_HOME_FAVORITE_IMAGE_COUNT = 2;

function getImageLoadingPriorityForIndex(
  index: number,
  eagerImageCount: number
): BookmarkImageLoadingPriority {
  return index >= 0 && index < eagerImageCount
    ? EAGER_IMAGE_LOADING_PRIORITY
    : LAZY_IMAGE_LOADING_PRIORITY;
}

export function getBookmarkListImageLoadingPriority(
  visibleIndex: number,
  options: { virtualWindowStart?: number } = {}
): BookmarkImageLoadingPriority {
  const absoluteIndex = visibleIndex + Math.max(0, options.virtualWindowStart ?? 0);
  return getImageLoadingPriorityForIndex(
    absoluteIndex,
    ABOVE_FOLD_BOOKMARK_LIST_IMAGE_COUNT
  );
}

export function getHomeFavoriteImageLoadingPriority(
  index: number
): BookmarkImageLoadingPriority {
  return getImageLoadingPriorityForIndex(index, ABOVE_FOLD_HOME_FAVORITE_IMAGE_COUNT);
}

export function getBookmarkAssetCardImageUrl(asset: BookmarkAsset) {
  return asset.thumbnailUrl ?? asset.contentUrl;
}

export function getBookmarkAssetPreviewImageUrl(asset: BookmarkAsset) {
  return asset.thumbnailUrl ?? asset.contentUrl;
}
