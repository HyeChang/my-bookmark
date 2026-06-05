export type HealthResponse = {
  ok: true;
};

export type AuthenticatedUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
};

export type SessionResponse =
  | {
      authenticated: true;
      user: AuthenticatedUser;
    }
  | {
    authenticated: false;
    };

export type BookmarkSearchMode = "all" | "title" | "content" | "folder";
export type BookmarkSortMode =
  | "created_desc"
  | "created_asc"
  | "opened_desc"
  | "title_asc"
  | "title_desc"
  | "site_asc"
  | "site_desc";
export type BookmarkRelativeDateRange = "all" | "7d" | "30d";
export type BookmarkTagMode = "and" | "or";
export type BookmarkAssetType = "image" | "capture";
export type BookmarkTrashMode = "active" | "trashed" | "all";

export type Bookmark = {
  id: string;
  folderId: string | null;
  tagIds: string[];
  url: string;
  isFavorite: boolean;
  isHidden: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  bookmarkColor: string | null;
  urlColor: string | null;
  sourceTitle: string | null;
  sourceContent: string | null;
  sourceSummary: string | null;
  userTitle: string | null;
  userContent: string | null;
  userSummary: string | null;
  displayTitle: string;
  displayContent: string;
  displaySummary: string;
  contentTruncated?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookmarkRequest = {
  url: string;
  folderId?: string | null;
  tagIds?: string[];
  userTitle?: string | null;
  userContent?: string | null;
  userSummary?: string | null;
  sourceTitle?: string | null;
  sourceContent?: string | null;
  sourceSummary?: string | null;
  isFavorite?: boolean;
  isHidden?: boolean;
  bookmarkColor?: string | null;
  urlColor?: string | null;
};

export type UpdateBookmarkRequest = {
  url?: string;
  folderId?: string | null;
  tagIds?: string[];
  userTitle?: string | null;
  userContent?: string | null;
  userSummary?: string | null;
  sourceTitle?: string | null;
  sourceContent?: string | null;
  sourceSummary?: string | null;
  isFavorite?: boolean;
  isHidden?: boolean;
  bookmarkColor?: string | null;
  urlColor?: string | null;
};

export type BookmarkResponse = {
  bookmark: Bookmark;
};

export type BookmarkRestoreResponse = BookmarkResponse;

export type BookmarkListResponse = {
  bookmarks: Bookmark[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

export type BookmarkCountBucket = {
  total: number;
  visible: number;
};

export type BookmarkCounts = {
  active: BookmarkCountBucket;
  favorite: BookmarkCountBucket;
  trashed: BookmarkCountBucket;
  unfiled: BookmarkCountBucket;
  byFolderId: Record<string, BookmarkCountBucket>;
};

export type BookmarkCountsResponse = {
  counts: BookmarkCounts;
};

export type BookmarkRecommendationsResponse = {
  favorites: Bookmark[];
  recent: Bookmark[];
  frequent: Bookmark[];
};

export type BookmarkOpenResponse = {
  ok: true;
};

export type BookmarkPermanentDeleteResponse = {
  ok: true;
};

export type BookmarkTrashEmptyResponse = {
  deletedCount: number;
};

export type BookmarkExtractRequest = {
  url: string;
};

export type BookmarkExtractPreviewBlock =
  | {
      type: "heading" | "paragraph" | "list-item";
      text: string;
    }
  | {
      type: "image";
      url: string;
      alt: string | null;
    };

export type BookmarkExtractPreview = {
  url: string;
  normalizedUrl: string;
  sourceTitle: string | null;
  sourceContent: string | null;
  sourceSummary: string | null;
  sourceImageUrl?: string | null;
  sourceBlocks?: BookmarkExtractPreviewBlock[];
  renderStatus?: "ready" | "js_required";
  renderSource?: "worker" | "extension";
  renderReason?: "spa_fallback" | "thin_content" | "missing_article";
};

export type BookmarkExtractResponse = {
  preview: BookmarkExtractPreview;
};

export type BookmarkPreviewResponse = {
  preview: BookmarkExtractPreview;
};

export type BookmarkAsset = {
  id: string;
  bookmarkId: string;
  assetType: BookmarkAssetType;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  contentUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkAssetResponse = {
  asset: BookmarkAsset;
};

export type BookmarkAssetListResponse = {
  assets: BookmarkAsset[];
};

export type BookmarkAssetBatchListResponse = {
  assetsByBookmarkId: Record<string, BookmarkAsset[]>;
};

export type MemoSortMode = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";
export type MemoViewMode = "list" | "card";

export type MemoRichContent = {
  type: "doc";
  content?: unknown[];
};

export type Memo = {
  id: string;
  folderId: string | null;
  tagIds: string[];
  title: string;
  contentJson: MemoRichContent;
  contentText: string;
  isFavorite: boolean;
  isHidden: boolean;
  isLocked: boolean;
  memoColor: string | null;
  assetCount: number;
  coverAsset: MemoAsset | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoRequest = {
  folderId?: string | null;
  tagIds?: string[];
  title: string;
  contentJson: MemoRichContent;
  contentText: string;
  isFavorite?: boolean;
  isHidden?: boolean;
  isLocked?: boolean;
  lockPassword?: string | null;
  memoColor?: string | null;
};

export type UpdateMemoRequest = {
  folderId?: string | null;
  tagIds?: string[];
  title?: string;
  contentJson?: MemoRichContent;
  contentText?: string;
  isFavorite?: boolean;
  isHidden?: boolean;
  isLocked?: boolean;
  lockPassword?: string | null;
  memoColor?: string | null;
};

export type MemoResponse = {
  memo: Memo;
};

export type MemoListRequest = {
  query?: string;
  folderId?: string | null;
  includeDescendantFolders?: boolean;
  tagId?: string;
  favorite?: boolean;
  includeHidden?: boolean;
  includeLocked?: boolean;
  sort?: MemoSortMode;
  limit?: number;
  offset?: number;
};

export type MemoListResponse = {
  memos: Memo[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

export type MemoDeleteResponse = {
  ok: true;
};

export type MemoLockStatusResponse = {
  isConfigured: boolean;
  isUnlocked: boolean;
};

export type MemoLockPasswordRequest = {
  password: string;
};

export type MemoLockResponse = {
  ok: true;
  status: MemoLockStatusResponse;
};

export type MemoFolder = {
  id: string;
  parentFolderId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  isHidden?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoFolderRequest = {
  parentFolderId?: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  isHidden?: boolean;
};

export type UpdateMemoFolderRequest = {
  parentFolderId?: string | null;
  name?: string;
  color?: string | null;
  icon?: string | null;
  isHidden?: boolean;
};

export type ReorderMemoFoldersRequest = {
  parentFolderId?: string | null;
  folderIds: string[];
};

export type MoveMemoFolderRequest = {
  parentFolderId?: string | null;
};

export type MemoFolderResponse = {
  folder: MemoFolder;
};

export type MemoFolderListResponse = {
  folders: MemoFolder[];
};

export type MemoFolderDeleteResponse = {
  ok: true;
};

export type MemoTag = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoTagRequest = {
  name: string;
  color?: string | null;
};

export type UpdateMemoTagRequest = {
  name?: string;
  color?: string | null;
};

export type MemoTagResponse = {
  tag: MemoTag;
};

export type MemoTagListResponse = {
  tags: MemoTag[];
};

export type MemoTagDeleteResponse = {
  ok: true;
};

export type MemoAsset = {
  id: string;
  memoId: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  contentUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoAssetRequest = {
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

export type UpdateMemoAssetRequest = {
  sortOrder?: number;
};

export type MemoAssetResponse = {
  asset: MemoAsset;
};

export type MemoAssetListResponse = {
  assets: MemoAsset[];
};

export type MemoAssetDeleteResponse = {
  ok: true;
};

export type Folder = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isHidden?: boolean;
  parentFolderId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateFolderRequest = {
  name: string;
  color?: string | null;
  icon?: string | null;
  isHidden?: boolean;
  parentFolderId?: string | null;
};

export type UpdateFolderRequest = {
  name?: string;
  color?: string | null;
  icon?: string | null;
  isHidden?: boolean;
  parentFolderId?: string | null;
};

export type ReorderFoldersRequest = {
  parentFolderId?: string | null;
  folderIds: string[];
};

export type MoveFolderRequest = {
  parentFolderId?: string | null;
};

export type FolderResponse = {
  folder: Folder;
};

export type FolderListResponse = {
  folders: Folder[];
};

export type Tag = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTagRequest = {
  name: string;
  color?: string | null;
};

export type UpdateTagRequest = {
  name?: string;
  color?: string | null;
};

export type TagResponse = {
  tag: Tag;
};

export type TagListResponse = {
  tags: Tag[];
};

export type ExtensionToken = {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateExtensionTokenRequest = {
  label: string;
};

export type CreateExtensionTokenResponse = {
  token: ExtensionToken;
  rawToken: string;
};

export type ExtensionTokenListResponse = {
  tokens: ExtensionToken[];
};
