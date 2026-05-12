import type { Bookmark, BookmarkAsset, Folder, Tag } from "@bookmark/shared";

type BookmarkExportPayload = {
  exportedAt: string;
  bookmarks: Bookmark[];
  folders: Folder[];
  tags: Tag[];
  bookmarkAssetsByBookmarkId: Record<string, BookmarkAsset[]>;
};

export function downloadBookmarkExport(exportPayload: BookmarkExportPayload) {
  const exportBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json"
  });
  const exportUrl = globalThis.URL.createObjectURL(exportBlob);
  const link = globalThis.document.createElement("a");
  link.href = exportUrl;
  link.download = `bookmark-backup-${exportPayload.exportedAt.slice(0, 10)}.json`;
  globalThis.document.body.append(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(exportUrl);
}
