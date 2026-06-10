import type {
  CreateMemoFolderRequest,
  CreateMemoRequest,
  CreateMemoTagRequest,
  Memo,
  MemoAsset,
  MemoFolder,
  MemoRichContent,
  MemoTag,
  UpdateMemoRequest
} from "@bookmark/shared";
import {
  createBackupZipBlob,
  createFileFromBackupBlob,
  getFileExtensionFromMimeType,
  readBackupZipBlob,
  type BackupZipAssetFile
} from "./backup-zip";
import type { BackupProgressReporter } from "./backup-progress";
import type { PreparedMemoImageUploadFile } from "./memo-image-compression";

export type MemoExportPayload = {
  exportedAt: string;
  memos: Memo[];
  folders: MemoFolder[];
  tags: MemoTag[];
  memoAssetsByMemoId: Record<string, MemoAsset[]>;
};

type MemoBackupAssetFileReference = {
  assetId: string;
  contentPath: string;
  thumbnailPath: string;
};

type MemoBackupManifest = MemoExportPayload & {
  kind: "memos";
  version: 2;
  assetFilesByMemoId: Record<string, MemoBackupAssetFileReference[]>;
};

type MemoBackupZipOptions = {
  fetchAssetBlob?: (url: string) => Promise<Blob>;
  onProgress?: BackupProgressReporter;
};

type MemoImportActions = {
  createMemoFolder: (input: CreateMemoFolderRequest) => Promise<MemoFolder>;
  createMemoTag: (input: CreateMemoTagRequest) => Promise<MemoTag>;
  createMemo: (input: CreateMemoRequest) => Promise<Memo>;
  updateMemo: (memoId: string, input: UpdateMemoRequest) => Promise<Memo>;
  uploadPreparedMemoAsset: (
    memoId: string,
    preparedFile: PreparedMemoImageUploadFile
  ) => Promise<MemoAsset>;
};

type MemoImportOptions = {
  onProgress?: BackupProgressReporter;
};

export type MemoImportResult = {
  folders: number;
  tags: number;
  memos: number;
  assets: number;
  skippedAssets: number;
};

async function fetchAssetBlob(url: string) {
  const res = await fetch(url, {
    credentials: "include"
  });
  if (!res.ok) {
    throw new Error("백업 메모 이미지 파일을 내려받지 못했습니다.");
  }

  return res.blob();
}

function getMemoAssetContentPath(memoId: string, assetId: string) {
  return `assets/memos/${memoId}/${assetId}/content`;
}

function getMemoAssetThumbnailPath(memoId: string, assetId: string) {
  return `assets/memos/${memoId}/${assetId}/thumbnail`;
}

function isMemoBackupManifest(value: unknown): value is MemoBackupManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const manifest = value as Partial<MemoBackupManifest>;
  return (
    manifest.kind === "memos" &&
    manifest.version === 2 &&
    Array.isArray(manifest.memos) &&
    Array.isArray(manifest.folders) &&
    Array.isArray(manifest.tags) &&
    Boolean(manifest.memoAssetsByMemoId) &&
    typeof manifest.memoAssetsByMemoId === "object"
  );
}

export async function createMemoBackupZipBlob(
  exportPayload: MemoExportPayload,
  options: MemoBackupZipOptions = {}
) {
  const loadAssetBlob = options.fetchAssetBlob ?? fetchAssetBlob;
  const assetFiles: BackupZipAssetFile[] = [];
  const assetFilesByMemoId: MemoBackupManifest["assetFilesByMemoId"] = {};
  const totalAssetBlobs = Object.values(exportPayload.memoAssetsByMemoId).reduce(
    (total, assets) => total + assets.length * 2,
    0
  );
  let loadedAssetBlobs = 0;
  const reportAssetProgress = () => {
    options.onProgress?.({
      message: "메모 이미지 준비 중",
      current: loadedAssetBlobs,
      total: totalAssetBlobs
    });
  };

  reportAssetProgress();

  for (const [memoId, assets] of Object.entries(exportPayload.memoAssetsByMemoId)) {
    assetFilesByMemoId[memoId] = [];

    for (const asset of assets) {
      const contentPath = getMemoAssetContentPath(memoId, asset.id);
      const thumbnailPath = getMemoAssetThumbnailPath(memoId, asset.id);
      assetFiles.push({
        path: contentPath,
        blob: await loadAssetBlob(asset.contentUrl)
      });
      loadedAssetBlobs += 1;
      reportAssetProgress();
      assetFiles.push({
        path: thumbnailPath,
        blob: await loadAssetBlob(asset.thumbnailUrl)
      });
      loadedAssetBlobs += 1;
      reportAssetProgress();
      assetFilesByMemoId[memoId].push({
        assetId: asset.id,
        contentPath,
        thumbnailPath
      });
    }
  }

  return createBackupZipBlob({
    manifest: {
      kind: "memos",
      version: 2,
      ...exportPayload,
      assetFilesByMemoId
    } satisfies MemoBackupManifest,
    assetFiles,
    onProgress: (progress) =>
      options.onProgress?.({
        ...progress,
        message: "메모 백업 압축 중"
      })
  });
}

export async function downloadMemoExport(
  exportPayload: MemoExportPayload,
  options: MemoBackupZipOptions = {}
) {
  const exportBlob = await createMemoBackupZipBlob(exportPayload, options);
  const exportUrl = globalThis.URL.createObjectURL(exportBlob);
  const link = globalThis.document.createElement("a");
  link.href = exportUrl;
  link.download = `memo-backup-${exportPayload.exportedAt.slice(0, 10)}.zip`;
  globalThis.document.body.append(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(exportUrl);
}

async function createMemoFolderIdMap(
  folders: MemoFolder[],
  createMemoFolder: MemoImportActions["createMemoFolder"],
  onProgress?: BackupProgressReporter
) {
  const idMap = new Map<string, string>();
  const pendingFolders = [...folders].sort((left, right) => left.sortOrder - right.sortOrder);
  const reportProgress = () => {
    onProgress?.({
      message: "메모 폴더 복원 중",
      current: idMap.size,
      total: folders.length
    });
  };

  reportProgress();

  while (pendingFolders.length > 0) {
    let didCreateFolder = false;

    for (let index = 0; index < pendingFolders.length; index += 1) {
      const folder = pendingFolders[index]!;
      const parentFolderId = folder.parentFolderId
        ? idMap.get(folder.parentFolderId)
        : null;
      if (folder.parentFolderId && !parentFolderId) {
        continue;
      }

      const createdFolder = await createMemoFolder({
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        isHidden: folder.isHidden === true,
        parentFolderId
      });
      idMap.set(folder.id, createdFolder.id);
      reportProgress();
      pendingFolders.splice(index, 1);
      didCreateFolder = true;
      break;
    }

    if (!didCreateFolder) {
      const folder = pendingFolders.shift()!;
      const createdFolder = await createMemoFolder({
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        isHidden: folder.isHidden === true,
        parentFolderId: null
      });
      idMap.set(folder.id, createdFolder.id);
      reportProgress();
    }
  }

  return idMap;
}

async function createMemoTagIdMap(
  tags: MemoTag[],
  createMemoTag: MemoImportActions["createMemoTag"],
  onProgress?: BackupProgressReporter
) {
  const idMap = new Map<string, string>();
  const reportProgress = () => {
    onProgress?.({
      message: "메모 태그 복원 중",
      current: idMap.size,
      total: tags.length
    });
  };

  reportProgress();

  for (const tag of tags) {
    const createdTag = await createMemoTag({
      name: tag.name,
      color: tag.color
    });
    idMap.set(tag.id, createdTag.id);
    reportProgress();
  }

  return idMap;
}

function createMemoImportInput(
  memo: Memo,
  folderIdMap: Map<string, string>,
  tagIdMap: Map<string, string>
): CreateMemoRequest {
  return {
    title: memo.title,
    folderId: memo.folderId ? folderIdMap.get(memo.folderId) ?? null : null,
    tagIds: memo.tagIds.map((tagId) => tagIdMap.get(tagId)).filter(Boolean) as string[],
    contentJson: memo.contentJson,
    contentText: memo.contentText,
    isFavorite: memo.isFavorite,
    isHidden: memo.isHidden,
    isLocked: false,
    memoColor: memo.memoColor
  };
}

function replaceMemoContentImageSources(value: unknown, sourceMap: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replaceMemoContentImageSources(item, sourceMap));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const nextRecord: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(record)) {
    if (key === "src" && typeof entryValue === "string" && sourceMap.has(entryValue)) {
      nextRecord[key] = sourceMap.get(entryValue);
      continue;
    }

    nextRecord[key] = replaceMemoContentImageSources(entryValue, sourceMap);
  }

  return nextRecord;
}

function replaceMemoRichContentImageSources(
  contentJson: MemoRichContent,
  sourceMap: Map<string, string>
) {
  return replaceMemoContentImageSources(contentJson, sourceMap) as MemoRichContent;
}

export async function importMemoBackupZipBlob(
  zipBlob: Blob,
  actions: MemoImportActions,
  options: MemoImportOptions = {}
): Promise<MemoImportResult> {
  const backup = await readBackupZipBlob(zipBlob, {
    onProgress: (progress) =>
      options.onProgress?.({
        ...progress,
        message:
          progress.message === "백업 이미지 읽는 중"
            ? "메모 백업 이미지 읽는 중"
            : "메모 백업 파일 읽는 중"
      })
  });
  if (!isMemoBackupManifest(backup.manifest)) {
    throw new Error("메모 백업 파일 형식이 올바르지 않습니다.");
  }

  const manifest = backup.manifest;
  const folderIdMap = await createMemoFolderIdMap(
    manifest.folders,
    actions.createMemoFolder,
    options.onProgress
  );
  const tagIdMap = await createMemoTagIdMap(
    manifest.tags,
    actions.createMemoTag,
    options.onProgress
  );
  const memoIdMap = new Map<string, string>();
  let importedAssets = 0;
  let skippedAssets = 0;
  let processedAssetRefs = 0;
  const totalAssetRefs = Object.values(manifest.assetFilesByMemoId).reduce(
    (total, assetRefs) => total + assetRefs.length,
    0
  );
  const reportMemoProgress = () => {
    options.onProgress?.({
      message: "메모 복원 중",
      current: memoIdMap.size,
      total: manifest.memos.length
    });
  };
  const reportAssetProgress = () => {
    options.onProgress?.({
      message: "메모 이미지 복원 중",
      current: processedAssetRefs,
      total: totalAssetRefs
    });
  };

  reportMemoProgress();
  reportAssetProgress();

  for (const memo of manifest.memos) {
    const createdMemo = await actions.createMemo(
      createMemoImportInput(memo, folderIdMap, tagIdMap)
    );
    memoIdMap.set(memo.id, createdMemo.id);
    reportMemoProgress();

    const sourceMap = new Map<string, string>();
    const assetRefs = manifest.assetFilesByMemoId[memo.id] ?? [];
    const oldAssets = manifest.memoAssetsByMemoId[memo.id] ?? [];
    const oldAssetsById = new Map(oldAssets.map((asset) => [asset.id, asset] as const));

    for (const assetRef of assetRefs) {
      const asset = oldAssetsById.get(assetRef.assetId);
      const contentBlob = backup.assetBlobs.get(assetRef.contentPath);
      const thumbnailBlob = backup.assetBlobs.get(assetRef.thumbnailPath);
      if (!asset || !contentBlob || !thumbnailBlob) {
        skippedAssets += 1;
        processedAssetRefs += 1;
        reportAssetProgress();
        continue;
      }

      const extension = getFileExtensionFromMimeType(asset.mimeType);
      const uploadedAsset = await actions.uploadPreparedMemoAsset(createdMemo.id, {
        file: createFileFromBackupBlob(contentBlob, `${asset.id}.${extension}`, asset.mimeType),
        thumbnail: createFileFromBackupBlob(
          thumbnailBlob,
          `${asset.id}-thumbnail.${extension}`,
          asset.mimeType
        )
      });
      sourceMap.set(asset.contentUrl, uploadedAsset.contentUrl);
      sourceMap.set(asset.thumbnailUrl, uploadedAsset.thumbnailUrl);
      importedAssets += 1;
      processedAssetRefs += 1;
      reportAssetProgress();
    }

    if (sourceMap.size > 0) {
      await actions.updateMemo(createdMemo.id, {
        contentJson: replaceMemoRichContentImageSources(memo.contentJson, sourceMap)
      });
    }
  }

  options.onProgress?.({
    message: "메모 백업 불러오기 완료",
    percent: 100
  });

  return {
    folders: folderIdMap.size,
    tags: tagIdMap.size,
    memos: memoIdMap.size,
    assets: importedAssets,
    skippedAssets
  };
}
