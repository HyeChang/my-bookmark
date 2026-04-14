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

export type Bookmark = {
  id: string;
  folderId: string | null;
  tagIds: string[];
  url: string;
  isFavorite: boolean;
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
  bookmarkColor?: string | null;
  urlColor?: string | null;
};

export type UpdateBookmarkRequest = {
  folderId?: string | null;
  tagIds?: string[];
  userTitle?: string | null;
  userContent?: string | null;
  userSummary?: string | null;
  isFavorite?: boolean;
  bookmarkColor?: string | null;
  urlColor?: string | null;
};

export type BookmarkResponse = {
  bookmark: Bookmark;
};

export type BookmarkListResponse = {
  bookmarks: Bookmark[];
};

export type Folder = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parentFolderId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateFolderRequest = {
  name: string;
  color?: string | null;
  icon?: string | null;
  parentFolderId?: string | null;
};

export type UpdateFolderRequest = {
  name?: string;
  color?: string | null;
  icon?: string | null;
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

export type TagResponse = {
  tag: Tag;
};

export type TagListResponse = {
  tags: Tag[];
};
