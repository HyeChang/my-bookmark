import type {
  BookmarkExtractRequest,
  BookmarkExtractPreview,
  BookmarkExtractResponse
} from "@bookmark/shared";

export async function extractBookmarkPreview(url: string) {
  const payload: BookmarkExtractRequest = {
    url
  };

  const res = await fetch("/api/bookmarks/extract", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error("Failed to extract bookmark preview");
  }

  const data = (await res.json()) as BookmarkExtractResponse;
  return data.preview as BookmarkExtractPreview;
}
