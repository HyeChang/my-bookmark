import type {
  BookmarkAsset,
  BookmarkAssetBatchListResponse,
  BookmarkAssetListResponse,
  BookmarkAssetResponse
} from "@bookmark/shared";
import { createBookmarkAssetThumbnail } from "./bookmark-asset-thumbnails";

function normalizeBookmarkIds(bookmarkIds: string[]) {
  return Array.from(
    new Set(bookmarkIds.map((bookmarkId) => bookmarkId.trim()).filter(Boolean))
  );
}

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

export async function loadBookmarkAssetsByBookmarks(bookmarkIds: string[]) {
  const normalizedBookmarkIds = normalizeBookmarkIds(bookmarkIds);
  if (normalizedBookmarkIds.length === 0) {
    return {};
  }

  const searchParams = new URLSearchParams();
  for (const bookmarkId of normalizedBookmarkIds) {
    searchParams.append("bookmarkId", bookmarkId);
  }

  const res = await fetch(`/api/bookmarks/assets?${searchParams.toString()}`, {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load bookmark assets");
  }

  const data = (await res.json()) as Partial<BookmarkAssetBatchListResponse>;
  const assetsByBookmarkId: Record<string, BookmarkAsset[]> = {};
  for (const bookmarkId of normalizedBookmarkIds) {
    const assets = data.assetsByBookmarkId?.[bookmarkId];
    assetsByBookmarkId[bookmarkId] = Array.isArray(assets) ? assets : [];
  }

  return assetsByBookmarkId;
}

export async function uploadBookmarkAsset(bookmarkId: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const thumbnail = await createBookmarkAssetThumbnail(file);
  if (thumbnail) {
    formData.set("thumbnail", thumbnail);
  }

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
