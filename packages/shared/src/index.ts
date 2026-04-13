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
