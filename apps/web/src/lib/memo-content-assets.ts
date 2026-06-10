import type { Memo, MemoAsset, MemoRichContent } from "@bookmark/shared";

type MemoImageUploadReference = {
  contentUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectMemoImageSourcesFromValue(value: unknown, sources: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMemoImageSourcesFromValue(item, sources));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.type === "image" && isRecord(value.attrs)) {
    const src = value.attrs.src;
    if (typeof src === "string" && src.trim()) {
      sources.add(src);
    }
  }

  Object.values(value).forEach((item) => collectMemoImageSourcesFromValue(item, sources));
}

export function collectMemoImageSources(contentJson: MemoRichContent) {
  const sources = new Set<string>();
  collectMemoImageSourcesFromValue(contentJson.content ?? [], sources);
  return sources;
}

export function getReferencedMemoImageUploads<T extends MemoImageUploadReference>(
  uploads: T[],
  contentJson: MemoRichContent
) {
  if (uploads.length === 0) {
    return [];
  }

  const sources = collectMemoImageSources(contentJson);
  return uploads.filter((upload) => sources.has(upload.contentUrl));
}

function isMemoAssetReferencedBySources(asset: MemoAsset, sources: Set<string>) {
  return (
    sources.has(asset.contentUrl) ||
    (typeof asset.thumbnailUrl === "string" && sources.has(asset.thumbnailUrl))
  );
}

export function getReferencedMemoAssets(assets: MemoAsset[], contentJson: MemoRichContent) {
  const sources = collectMemoImageSources(contentJson);
  return assets.filter((asset) => isMemoAssetReferencedBySources(asset, sources));
}

function compareMemoAssetCoverPriority(left: MemoAsset, right: MemoAsset) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function getLatestMemoAsset(assets: MemoAsset[]) {
  if (assets.length === 0) {
    return null;
  }

  return [...assets].sort(compareMemoAssetCoverPriority).at(-1) ?? null;
}

export function applyMemoContentAssetPreview(memo: Memo, referencedAssets: MemoAsset[]): Memo {
  return {
    ...memo,
    assetCount: referencedAssets.length,
    coverAsset: getLatestMemoAsset(referencedAssets)
  };
}
