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
  createdAt: string;
  updatedAt: string;
};

export type BookmarkAssetResponse = {
  asset: BookmarkAsset;
};

export type BookmarkAssetListResponse = {
  assets: BookmarkAsset[];
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
