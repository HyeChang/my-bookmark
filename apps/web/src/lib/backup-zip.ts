import JSZip from "jszip";

export type BackupZipAssetFile = {
  path: string;
  blob: Blob;
};

export type BackupZipInput = {
  manifest: unknown;
  assetFiles: BackupZipAssetFile[];
};

export type BackupZipContent = {
  manifest: unknown;
  assetBlobs: Map<string, Blob>;
};

const mimeExtensionMap: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp"
};

export function getFileExtensionFromMimeType(mimeType: string | null | undefined) {
  if (!mimeType) {
    return "bin";
  }

  return mimeExtensionMap[mimeType] ?? "bin";
}

export function createFileFromBackupBlob(blob: Blob, fileName: string, mimeType?: string | null) {
  const fileType = mimeType || blob.type || "application/octet-stream";
  return new File([blob], fileName, { type: fileType });
}

export async function createBackupZipBlob({ manifest, assetFiles }: BackupZipInput) {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  for (const assetFile of assetFiles) {
    zip.file(assetFile.path, assetFile.blob);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6
    }
  });
}

export async function readBackupZipBlob(zipBlob: Blob): Promise<BackupZipContent> {
  const zip = await JSZip.loadAsync(zipBlob);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("백업 파일에 manifest.json이 없습니다.");
  }

  const manifest = JSON.parse(await manifestFile.async("text")) as unknown;
  const assetBlobs = new Map<string, Blob>();
  const assetEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name !== "manifest.json"
  );

  await Promise.all(
    assetEntries.map(async (entry) => {
      assetBlobs.set(entry.name, await entry.async("blob"));
    })
  );

  return {
    manifest,
    assetBlobs
  };
}
