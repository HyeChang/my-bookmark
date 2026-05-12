const BOOKMARK_ASSET_THUMBNAIL_MAX_EDGE = 512;
const BOOKMARK_ASSET_THUMBNAIL_MIME_TYPE = "image/webp";
const BOOKMARK_ASSET_THUMBNAIL_QUALITY = 0.78;
const BOOKMARK_ASSET_IMAGE_LOAD_TIMEOUT_MS = 250;

export function shouldCreateBookmarkAssetThumbnail(file: File) {
  return file.type.startsWith("image/") && file.type !== "image/gif";
}

export function createBookmarkAssetThumbnailFileName(fileName: string) {
  const trimmedName = fileName.trim() || "asset";
  const extensionIndex = trimmedName.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? trimmedName.slice(0, extensionIndex) : trimmedName;

  return `${baseName || "asset"}-thumb.webp`;
}

export function getBookmarkAssetThumbnailDimensions(
  width: number,
  height: number,
  maxEdge = BOOKMARK_ASSET_THUMBNAIL_MAX_EDGE
) {
  if (width <= 0 || height <= 0) {
    return {
      width: maxEdge,
      height: maxEdge
    };
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = BOOKMARK_ASSET_THUMBNAIL_MIME_TYPE,
  quality = BOOKMARK_ASSET_THUMBNAIL_QUALITY
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function createThumbnailFromBitmap(file: File) {
  if (typeof globalThis.createImageBitmap !== "function") {
    return null;
  }

  const bitmap = await globalThis.createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return null;
  }

  try {
    const dimensions = getBookmarkAssetThumbnailDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    return canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
}

async function createThumbnailFromImageElement(file: File) {
  if (typeof URL.createObjectURL !== "function") {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const imageLoaded = new Promise<HTMLImageElement | null>((resolve) => {
      const timeoutId = globalThis.setTimeout(
        () => resolve(null),
        BOOKMARK_ASSET_IMAGE_LOAD_TIMEOUT_MS
      );
      image.onload = () => {
        globalThis.clearTimeout(timeoutId);
        resolve(image);
      };
      image.onerror = () => {
        globalThis.clearTimeout(timeoutId);
        resolve(null);
      };
    });
    image.decoding = "async";
    image.src = objectUrl;
    const loadedImage = await imageLoaded;
    if (!loadedImage) {
      return null;
    }

    const dimensions = getBookmarkAssetThumbnailDimensions(
      loadedImage.naturalWidth,
      loadedImage.naturalHeight
    );
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(loadedImage, 0, 0, dimensions.width, dimensions.height);
    return canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createBookmarkAssetThumbnail(file: File) {
  if (!shouldCreateBookmarkAssetThumbnail(file) || typeof document === "undefined") {
    return null;
  }

  const thumbnailBlob =
    (await createThumbnailFromBitmap(file)) ?? (await createThumbnailFromImageElement(file));
  if (!thumbnailBlob) {
    return null;
  }

  return new File([thumbnailBlob], createBookmarkAssetThumbnailFileName(file.name), {
    type: thumbnailBlob.type || BOOKMARK_ASSET_THUMBNAIL_MIME_TYPE
  });
}
