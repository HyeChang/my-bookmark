import type { Bookmark, BookmarkAsset, Folder, Tag } from "@bookmark/shared";

import type {
  BookmarkDisplaySettings,
  BookmarkListRowViewModel,
  BookmarkViewMode
} from "./BookmarkResultsPanel";
import type { HomeFavoriteCardViewModel } from "./HomePanel";
import type { RecommendationCardViewModel } from "./RecommendationPanel";
import { hasTextContent } from "./bookmark-preview-utils";

export type BookmarkRecommendationsState = {
  favorites: Bookmark[];
  recent: Bookmark[];
  frequent: Bookmark[];
};

export type RecommendationKind = keyof BookmarkRecommendationsState;

export type BookmarkListRowCacheEntry = {
  row: BookmarkListRowViewModel;
  bookmark: Bookmark;
  assets: BookmarkAsset[];
  folderName: string;
  previewText: string;
  summaryStateLabel: string;
  tagSignature: string;
  remainingTagCount: number;
  isTrashed: boolean;
  shouldShowCover: boolean;
  shouldShowListCover: boolean;
  shouldShowTitle: boolean;
  shouldShowDescription: boolean;
  shouldShowTags: boolean;
  shouldShowInfo: boolean;
};

export type HomeFavoriteCardCacheEntry = {
  card: HomeFavoriteCardViewModel;
  bookmark: Bookmark;
  assets: BookmarkAsset[];
  folderName: string;
  previewText: string;
  tagSignature: string;
};

export type RecommendationCardCacheEntry = {
  card: RecommendationCardViewModel;
  bookmark: Bookmark;
  reasonLabel: string;
  folderName: string;
  summaryText: string;
};

type BookmarkAssetsById = Record<string, BookmarkAsset[] | undefined>;

const EMPTY_BOOKMARK_ASSETS: BookmarkAsset[] = [];

type EntityLookupOptions = {
  extensionFolderIds: Set<string>;
  foldersById: Map<string, Folder>;
};

export function getBookmarkPreviewText(bookmark: Bookmark) {
  if (hasTextContent(bookmark.userSummary)) {
    return bookmark.userSummary ?? "";
  }

  if (hasTextContent(bookmark.userContent)) {
    return bookmark.userContent ?? "";
  }

  if (hasTextContent(bookmark.sourceSummary)) {
    return bookmark.sourceSummary ?? "";
  }

  if (hasTextContent(bookmark.displaySummary)) {
    return bookmark.displaySummary;
  }

  if (hasTextContent(bookmark.sourceContent)) {
    return bookmark.sourceContent ?? "";
  }

  if (hasTextContent(bookmark.displayContent)) {
    return bookmark.displayContent;
  }

  return "";
}

export function getBookmarkSummaryStateLabel(bookmark: Bookmark) {
  if (hasTextContent(bookmark.userSummary)) {
    return "직접 요약";
  }

  if (hasTextContent(bookmark.userContent)) {
    return "직접 정리";
  }

  if (hasTextContent(bookmark.sourceSummary)) {
    return "자동 요약";
  }

  if (hasTextContent(bookmark.displaySummary)) {
    return "요약";
  }

  if (hasTextContent(bookmark.sourceContent)) {
    return "자동 추출";
  }

  if (hasTextContent(bookmark.displayContent)) {
    return "내용";
  }

  return "요약 없음";
}

function getFolderName(bookmark: Bookmark, { extensionFolderIds, foldersById }: EntityLookupOptions) {
  return !bookmark.folderId || extensionFolderIds.has(bookmark.folderId)
    ? "미분류"
    : foldersById.get(bookmark.folderId)?.name ?? bookmark.folderId;
}

function getRecommendationReasonLabel(kind: RecommendationKind) {
  switch (kind) {
    case "favorites":
      return "즐겨찾기 기반";
    case "recent":
      return "최근 열람 기반";
    case "frequent":
      return "반복 열람 기반";
    default:
      return "추천";
  }
}

export function buildHomeFavoriteCards({
  bookmarks,
  bookmarkAssetsByBookmarkId,
  extensionFolderIds,
  foldersById,
  hasLoadedTags,
  previousCache,
  tagsById
}: {
  bookmarks: Bookmark[];
  bookmarkAssetsByBookmarkId: BookmarkAssetsById;
  extensionFolderIds: Set<string>;
  foldersById: Map<string, Folder>;
  hasLoadedTags: boolean;
  previousCache: Map<string, HomeFavoriteCardCacheEntry>;
  tagsById: Map<string, Tag>;
}) {
  const nextCache = new Map<string, HomeFavoriteCardCacheEntry>();
  const cards = bookmarks.map((bookmark) => {
    const assets = bookmarkAssetsByBookmarkId[bookmark.id] ?? EMPTY_BOOKMARK_ASSETS;
    const visibleTagItems = hasLoadedTags
      ? bookmark.tagIds.slice(0, 2).map((tagId) => {
          const tag = tagsById.get(tagId);
          return {
            id: tagId,
            name: tag?.name ?? tagId,
            color: tag?.color ?? null
          };
        })
      : [];
    const tagSignature = visibleTagItems
      .map((tag) => `${tag.id}\u001f${tag.name}\u001f${tag.color ?? ""}`)
      .join("\u001e");
    const folderName = getFolderName(bookmark, { extensionFolderIds, foldersById });
    const previewText = getBookmarkPreviewText(bookmark);
    const previousCardEntry = previousCache.get(bookmark.id);

    if (
      previousCardEntry &&
      previousCardEntry.bookmark === bookmark &&
      previousCardEntry.assets === assets &&
      previousCardEntry.folderName === folderName &&
      previousCardEntry.previewText === previewText &&
      previousCardEntry.tagSignature === tagSignature
    ) {
      nextCache.set(bookmark.id, previousCardEntry);
      return previousCardEntry.card;
    }

    const card = {
      bookmark,
      coverAsset: assets[0] ?? null,
      folderName,
      previewText,
      visibleTagItems,
      menuId: `home:${bookmark.id}`
    };
    const nextCardEntry = {
      card,
      bookmark,
      assets,
      folderName,
      previewText,
      tagSignature
    };

    nextCache.set(bookmark.id, nextCardEntry);
    return card;
  });

  return { cards, cache: nextCache };
}

export function buildBookmarkListRows({
  bookmarkAssetsByBookmarkId,
  bookmarkCardDisplaySettings,
  bookmarkListDisplaySettings,
  bookmarks,
  bookmarkViewMode,
  extensionFolderIds,
  foldersById,
  isTrashBookmarkView,
  previousCache,
  shouldUseCompactMobileCards,
  tagsById
}: {
  bookmarkAssetsByBookmarkId: BookmarkAssetsById;
  bookmarkCardDisplaySettings: BookmarkDisplaySettings;
  bookmarkListDisplaySettings: BookmarkDisplaySettings;
  bookmarks: Bookmark[];
  bookmarkViewMode: BookmarkViewMode;
  extensionFolderIds: Set<string>;
  foldersById: Map<string, Folder>;
  isTrashBookmarkView: boolean;
  previousCache: Map<string, BookmarkListRowCacheEntry>;
  shouldUseCompactMobileCards: boolean;
  tagsById: Map<string, Tag>;
}) {
  const nextCache = new Map<string, BookmarkListRowCacheEntry>();
  const rows = bookmarks.map((bookmark) => {
    const assets = bookmarkAssetsByBookmarkId[bookmark.id] ?? EMPTY_BOOKMARK_ASSETS;
    const tagItems = bookmark.tagIds.map((tagId) => {
      const tag = tagsById.get(tagId);
      return {
        id: tagId,
        name: tag?.name ?? tagId,
        color: tag?.color ?? null
      };
    });
    const tagSignature = tagItems
      .map((tag) => `${tag.id}\u001f${tag.name}\u001f${tag.color ?? ""}`)
      .join("\u001e");
    const displaySettings =
      bookmarkViewMode === "list"
        ? bookmarkListDisplaySettings
        : bookmarkCardDisplaySettings;
    const appliesDisplaySettings = bookmarkViewMode !== "title";
    const shouldShowCover =
      (bookmarkViewMode === "card" || bookmarkViewMode === "moodboard") &&
      displaySettings.coverImage &&
      assets.length > 0;
    const shouldShowListCover =
      bookmarkViewMode === "list" &&
      displaySettings.coverImage &&
      assets.length > 0;
    const shouldShowTitle = !appliesDisplaySettings || displaySettings.title;
    const shouldShowDescription =
      bookmarkViewMode !== "title" &&
      (!appliesDisplaySettings || displaySettings.description);
    const shouldShowTags = !appliesDisplaySettings || displaySettings.tags;
    const shouldShowInfo =
      bookmarkViewMode !== "title" &&
      (!appliesDisplaySettings || displaySettings.bookmarkInfo);
    const visibleTagItems = tagItems.slice(0, shouldUseCompactMobileCards ? 1 : 2);
    const folderName = getFolderName(bookmark, { extensionFolderIds, foldersById });
    const previewText = getBookmarkPreviewText(bookmark);
    const summaryStateLabel = getBookmarkSummaryStateLabel(bookmark);
    const remainingTagCount = Math.max(0, tagItems.length - visibleTagItems.length);
    const isTrashed = bookmark.isTrashed || isTrashBookmarkView;
    const previousRowEntry = previousCache.get(bookmark.id);

    if (
      previousRowEntry &&
      previousRowEntry.bookmark === bookmark &&
      previousRowEntry.assets === assets &&
      previousRowEntry.folderName === folderName &&
      previousRowEntry.previewText === previewText &&
      previousRowEntry.summaryStateLabel === summaryStateLabel &&
      previousRowEntry.tagSignature === tagSignature &&
      previousRowEntry.remainingTagCount === remainingTagCount &&
      previousRowEntry.isTrashed === isTrashed &&
      previousRowEntry.shouldShowCover === shouldShowCover &&
      previousRowEntry.shouldShowListCover === shouldShowListCover &&
      previousRowEntry.shouldShowTitle === shouldShowTitle &&
      previousRowEntry.shouldShowDescription === shouldShowDescription &&
      previousRowEntry.shouldShowTags === shouldShowTags &&
      previousRowEntry.shouldShowInfo === shouldShowInfo
    ) {
      nextCache.set(bookmark.id, previousRowEntry);
      return previousRowEntry.row;
    }

    const row = {
      bookmark,
      assets,
      assetCount: assets.length,
      coverAsset: assets[0] ?? null,
      folderName,
      previewText,
      summaryStateLabel,
      visibleTagItems,
      remainingTagCount,
      isTrashed,
      shouldShowCover,
      shouldShowListCover,
      shouldShowTitle,
      shouldShowDescription,
      shouldShowTags,
      shouldShowInfo
    };
    const nextRowEntry = {
      row,
      bookmark,
      assets,
      folderName,
      previewText,
      summaryStateLabel,
      tagSignature,
      remainingTagCount,
      isTrashed,
      shouldShowCover,
      shouldShowListCover,
      shouldShowTitle,
      shouldShowDescription,
      shouldShowTags,
      shouldShowInfo
    };

    nextCache.set(bookmark.id, nextRowEntry);
    return row;
  });

  return { rows, cache: nextCache };
}

export function buildRecommendationCardsByKind({
  extensionFolderIds,
  foldersById,
  previousCache,
  recommendations
}: {
  extensionFolderIds: Set<string>;
  foldersById: Map<string, Folder>;
  previousCache: Map<string, RecommendationCardCacheEntry>;
  recommendations: BookmarkRecommendationsState;
}) {
  const nextCache = new Map<string, RecommendationCardCacheEntry>();

  function createRecommendationCards(
    kind: RecommendationKind,
    recommendationBookmarks: Bookmark[]
  ) {
    const reasonLabel = getRecommendationReasonLabel(kind);

    return recommendationBookmarks.map((bookmark) => {
      const itemKey = `${kind}-${bookmark.id}`;
      const folderName = getFolderName(bookmark, { extensionFolderIds, foldersById });
      const previewText = getBookmarkPreviewText(bookmark);
      const summaryText = hasTextContent(previewText) ? previewText : "요약 없음";
      const previousCardEntry = previousCache.get(itemKey);

      if (
        previousCardEntry &&
        previousCardEntry.bookmark === bookmark &&
        previousCardEntry.reasonLabel === reasonLabel &&
        previousCardEntry.folderName === folderName &&
        previousCardEntry.summaryText === summaryText
      ) {
        nextCache.set(itemKey, previousCardEntry);
        return previousCardEntry.card;
      }

      const card = {
        itemKey,
        bookmark,
        reasonLabel,
        folderName,
        summaryText
      };
      const nextCardEntry = {
        card,
        bookmark,
        reasonLabel,
        folderName,
        summaryText
      };

      nextCache.set(itemKey, nextCardEntry);
      return card;
    });
  }

  const cardsByKind = {
    favorites: createRecommendationCards("favorites", recommendations.favorites),
    recent: createRecommendationCards("recent", recommendations.recent),
    frequent: createRecommendationCards("frequent", recommendations.frequent)
  };

  return { cardsByKind, cache: nextCache };
}
