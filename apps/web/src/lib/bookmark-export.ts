import type {
  Bookmark,
  BookmarkAsset,
  CreateBookmarkRequest,
  CreateFolderRequest,
  CreateTagRequest,
  Folder,
  Tag
} from "@bookmark/shared";
import {
  createBackupZipBlob,
  createFileFromBackupBlob,
  getFileExtensionFromMimeType,
  readBackupZipBlob,
  type BackupZipAssetFile
} from "./backup-zip";

export type BookmarkExportPayload = {
  exportedAt: string;
  bookmarks: Bookmark[];
  folders: Folder[];
  tags: Tag[];
  bookmarkAssetsByBookmarkId: Record<string, BookmarkAsset[]>;
};

type BookmarkBackupAssetFileReference = {
  assetId: string;
  contentPath: string;
  thumbnailPath?: string;
};

type BookmarkBackupManifest = BookmarkExportPayload & {
  kind: "bookmarks";
  version: 2;
  assetFilesByBookmarkId: Record<string, BookmarkBackupAssetFileReference[]>;
};

type BookmarkBackupZipOptions = {
  fetchAssetBlob?: (url: string) => Promise<Blob>;
};

type BookmarkImportActions = {
  createFolder: (input: CreateFolderRequest) => Promise<Folder>;
  createTag: (input: CreateTagRequest) => Promise<Tag>;
  createBookmark: (input: CreateBookmarkRequest) => Promise<Bookmark>;
  uploadBookmarkAsset: (bookmarkId: string, file: File) => Promise<BookmarkAsset>;
};

export type BookmarkImportResult = {
  folders: number;
  tags: number;
  bookmarks: number;
  assets: number;
  skippedAssets: number;
};

async function fetchAssetBlob(url: string) {
  const res = await fetch(url, {
    credentials: "include"
  });
  if (!res.ok) {
    throw new Error("백업 이미지 파일을 내려받지 못했습니다.");
  }

  return res.blob();
}

function getBookmarkAssetContentPath(bookmarkId: string, assetId: string) {
  return `assets/bookmarks/${bookmarkId}/${assetId}/content`;
}

function getBookmarkAssetThumbnailPath(bookmarkId: string, assetId: string) {
  return `assets/bookmarks/${bookmarkId}/${assetId}/thumbnail`;
}

function isBookmarkBackupManifest(value: unknown): value is BookmarkBackupManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const manifest = value as Partial<BookmarkBackupManifest>;
  return (
    manifest.kind === "bookmarks" &&
    manifest.version === 2 &&
    Array.isArray(manifest.bookmarks) &&
    Array.isArray(manifest.folders) &&
    Array.isArray(manifest.tags) &&
    Boolean(manifest.bookmarkAssetsByBookmarkId) &&
    typeof manifest.bookmarkAssetsByBookmarkId === "object"
  );
}

export async function createBookmarkBackupZipBlob(
  exportPayload: BookmarkExportPayload,
  options: BookmarkBackupZipOptions = {}
) {
  const loadAssetBlob = options.fetchAssetBlob ?? fetchAssetBlob;
  const assetFiles: BackupZipAssetFile[] = [];
  const assetFilesByBookmarkId: BookmarkBackupManifest["assetFilesByBookmarkId"] = {};

  for (const [bookmarkId, assets] of Object.entries(exportPayload.bookmarkAssetsByBookmarkId)) {
    assetFilesByBookmarkId[bookmarkId] = [];

    for (const asset of assets) {
      const contentPath = getBookmarkAssetContentPath(bookmarkId, asset.id);
      assetFiles.push({
        path: contentPath,
        blob: await loadAssetBlob(asset.contentUrl)
      });

      let thumbnailPath: string | undefined;
      if (asset.thumbnailUrl) {
        thumbnailPath = getBookmarkAssetThumbnailPath(bookmarkId, asset.id);
        assetFiles.push({
          path: thumbnailPath,
          blob: await loadAssetBlob(asset.thumbnailUrl)
        });
      }

      assetFilesByBookmarkId[bookmarkId].push({
        assetId: asset.id,
        contentPath,
        thumbnailPath
      });
    }
  }

  return createBackupZipBlob({
    manifest: {
      kind: "bookmarks",
      version: 2,
      ...exportPayload,
      assetFilesByBookmarkId
    } satisfies BookmarkBackupManifest,
    assetFiles
  });
}

export async function downloadBookmarkExport(exportPayload: BookmarkExportPayload) {
  const exportBlob = await createBookmarkBackupZipBlob(exportPayload);
  const exportUrl = globalThis.URL.createObjectURL(exportBlob);
  const link = globalThis.document.createElement("a");
  link.href = exportUrl;
  link.download = `bookmark-backup-${exportPayload.exportedAt.slice(0, 10)}.zip`;
  globalThis.document.body.append(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(exportUrl);
}

async function createFolderIdMap(
  folders: Folder[],
  createFolder: BookmarkImportActions["createFolder"]
) {
  const idMap = new Map<string, string>();
  const pendingFolders = [...folders].sort((left, right) => left.sortOrder - right.sortOrder);

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

      const createdFolder = await createFolder({
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        isHidden: folder.isHidden === true,
        parentFolderId
      });
      idMap.set(folder.id, createdFolder.id);
      pendingFolders.splice(index, 1);
      didCreateFolder = true;
      break;
    }

    if (!didCreateFolder) {
      const folder = pendingFolders.shift()!;
      const createdFolder = await createFolder({
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        isHidden: folder.isHidden === true,
        parentFolderId: null
      });
      idMap.set(folder.id, createdFolder.id);
    }
  }

  return idMap;
}

async function createTagIdMap(tags: Tag[], createTag: BookmarkImportActions["createTag"]) {
  const idMap = new Map<string, string>();

  for (const tag of tags) {
    const createdTag = await createTag({
      name: tag.name,
      color: tag.color
    });
    idMap.set(tag.id, createdTag.id);
  }

  return idMap;
}

function createBookmarkImportInput(
  bookmark: Bookmark,
  folderIdMap: Map<string, string>,
  tagIdMap: Map<string, string>
): CreateBookmarkRequest {
  return {
    url: bookmark.url,
    folderId: bookmark.folderId ? folderIdMap.get(bookmark.folderId) ?? null : null,
    tagIds: bookmark.tagIds.map((tagId) => tagIdMap.get(tagId)).filter(Boolean) as string[],
    userTitle: bookmark.userTitle,
    userContent: bookmark.userContent,
    userSummary: bookmark.userSummary,
    sourceTitle: bookmark.sourceTitle,
    sourceContent: bookmark.sourceContent,
    sourceSummary: bookmark.sourceSummary,
    isFavorite: bookmark.isFavorite,
    isHidden: bookmark.isHidden,
    bookmarkColor: bookmark.bookmarkColor,
    urlColor: bookmark.urlColor
  };
}

export async function importBookmarkBackupZipBlob(
  zipBlob: Blob,
  actions: BookmarkImportActions
): Promise<BookmarkImportResult> {
  const backup = await readBackupZipBlob(zipBlob);
  if (!isBookmarkBackupManifest(backup.manifest)) {
    throw new Error("북마크 백업 파일 형식이 올바르지 않습니다.");
  }

  const manifest = backup.manifest;
  const folderIdMap = await createFolderIdMap(manifest.folders, actions.createFolder);
  const tagIdMap = await createTagIdMap(manifest.tags, actions.createTag);
  const bookmarkIdMap = new Map<string, string>();
  let importedAssets = 0;
  let skippedAssets = 0;

  for (const bookmark of manifest.bookmarks) {
    const createdBookmark = await actions.createBookmark(
      createBookmarkImportInput(bookmark, folderIdMap, tagIdMap)
    );
    bookmarkIdMap.set(bookmark.id, createdBookmark.id);

    const assetRefs = manifest.assetFilesByBookmarkId[bookmark.id] ?? [];
    const oldAssets = manifest.bookmarkAssetsByBookmarkId[bookmark.id] ?? [];
    const oldAssetsById = new Map(oldAssets.map((asset) => [asset.id, asset] as const));

    for (const assetRef of assetRefs) {
      const asset = oldAssetsById.get(assetRef.assetId);
      const contentBlob = backup.assetBlobs.get(assetRef.contentPath);
      if (!asset || !contentBlob) {
        skippedAssets += 1;
        continue;
      }

      const file = createFileFromBackupBlob(
        contentBlob,
        `${asset.id}.${getFileExtensionFromMimeType(asset.mimeType)}`,
        asset.mimeType
      );
      await actions.uploadBookmarkAsset(createdBookmark.id, file);
      importedAssets += 1;
    }
  }

  return {
    folders: folderIdMap.size,
    tags: tagIdMap.size,
    bookmarks: bookmarkIdMap.size,
    assets: importedAssets,
    skippedAssets
  };
}
