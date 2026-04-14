import type {
  BookmarkAsset,
  BookmarkAssetListResponse,
  BookmarkAssetResponse
} from "@bookmark/shared";

export async function loadBookmarkAssets(bookmarkId: string) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}/assets`, {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load bookmark assets");
  }

  const data = (await res.json()) as Partial<BookmarkAssetListResponse>;
  return Array.isArray(data.assets) ? (data.assets as BookmarkAsset[]) : [];
}

export async function uploadBookmarkAsset(bookmarkId: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const res = await fetch(`/api/bookmarks/${bookmarkId}/assets`, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!res.ok) {
    throw new Error("Failed to upload bookmark asset");
  }

  const data = (await res.json()) as BookmarkAssetResponse;
  return data.asset;
}

export async function deleteBookmarkAsset(bookmarkId: string, assetId: string) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}/assets/${assetId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to delete bookmark asset");
  }
}
