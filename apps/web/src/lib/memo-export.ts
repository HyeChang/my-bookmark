import type { Memo, MemoAsset, MemoFolder, MemoTag } from "@bookmark/shared";

type MemoExportPayload = {
  exportedAt: string;
  memos: Memo[];
  folders: MemoFolder[];
  tags: MemoTag[];
  memoAssetsByMemoId: Record<string, MemoAsset[]>;
};

export function downloadMemoExport(exportPayload: MemoExportPayload) {
  const exportBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json"
  });
  const exportUrl = globalThis.URL.createObjectURL(exportBlob);
  const link = globalThis.document.createElement("a");
  link.href = exportUrl;
  link.download = `memo-backup-${exportPayload.exportedAt.slice(0, 10)}.json`;
  globalThis.document.body.append(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(exportUrl);
}
