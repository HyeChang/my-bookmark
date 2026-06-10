import JSZip from "jszip";
import { describe, expect, it } from "vitest";

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
});
