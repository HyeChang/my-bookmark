import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import {
  createBackupZipBlob,
  readBackupZipBlob,
  type BackupZipAssetFile
} from "../lib/backup-zip";

describe("backup zip helpers", () => {
  it("writes a manifest and asset blobs into a zip archive", async () => {
    const assetFiles: BackupZipAssetFile[] = [
      {
        path: "assets/bookmarks/bookmark-1/asset-1/content",
        blob: new Blob(["image-bytes"], { type: "image/png" })
      }
    ];

    const zipBlob = await createBackupZipBlob({
      manifest: {
        kind: "bookmarks",
        version: 2,
        bookmarks: [{ id: "bookmark-1" }]
      },
      assetFiles
    });
    const zip = await JSZip.loadAsync(zipBlob);

    expect(JSON.parse(await zip.file("manifest.json")!.async("text"))).toMatchObject({
      kind: "bookmarks",
      version: 2
    });
    expect(
      await zip.file("assets/bookmarks/bookmark-1/asset-1/content")!.async("string")
    ).toBe("image-bytes");
  });

  it("reads a manifest and asset blobs from a zip archive", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ kind: "memos", version: 2 }));
    zip.file("assets/memos/memo-1/asset-1/content", new Blob(["memo-image"]));
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const backup = await readBackupZipBlob(zipBlob);

    expect(backup.manifest).toEqual({ kind: "memos", version: 2 });
    expect(await backup.assetBlobs.get("assets/memos/memo-1/asset-1/content")!.text()).toBe(
      "memo-image"
    );
  });

  it("reports progress while creating and reading backup zip files", async () => {
    const createProgress = vi.fn();
    const zipBlob = await createBackupZipBlob({
      manifest: { kind: "bookmarks", version: 2 },
      assetFiles: [
        {
          path: "assets/bookmarks/bookmark-1/asset-1/content",
          blob: new Blob(["bookmark-image"], { type: "image/png" })
        }
      ],
      onProgress: createProgress
    });

    expect(createProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "백업 파일 압축 중",
        percent: expect.any(Number)
      })
    );

    const readProgress = vi.fn();
    await readBackupZipBlob(zipBlob, { onProgress: readProgress });

    expect(readProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "백업 이미지 읽는 중",
        current: 1,
        total: 1
      })
    );
  });
});
