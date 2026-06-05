const MEMO_IMAGE_MAX_EDGE = 1600;
const MEMO_IMAGE_THUMBNAIL_MAX_EDGE = 512;
const MEMO_IMAGE_MIME_TYPE = "image/webp";
const MEMO_IMAGE_QUALITY = 0.82;
const MEMO_IMAGE_THUMBNAIL_QUALITY = 0.78;
const MEMO_IMAGE_LOAD_TIMEOUT_MS = 250;

export type PreparedMemoImageUploadFile = {
  sourceFile: File;
  file: File;
  thumbnail: File | null;
};

type MemoImageResizeVariant = {
  maxEdge: number;
  quality: number;
  suffix?: string;
};

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isGifFile(file: File) {
  return file.type === "image/gif";
}

function createWebpFileName(fileName: string, suffix = "") {
  const trimmedName = fileName.trim() || "image";
  const extensionIndex = trimmedName.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? trimmedName.slice(0, extensionIndex) : trimmedName;

  return `${baseName || "image"}${suffix}.webp`;
}

function getResizedDimensions(width: number, height: number, maxEdge: number) {
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

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, MEMO_IMAGE_MIME_TYPE, quality);
  });
}

async function createResizedImageFileFromSource(
  file: File,
  imageSource: CanvasImageSource,
  width: number,
  height: number,
  variant: MemoImageResizeVariant
) {
  const dimensions = getResizedDimensions(width, height, variant.maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(imageSource, 0, 0, dimensions.width, dimensions.height);
  const resizedBlob = await canvasToBlob(canvas, variant.quality);
  if (!resizedBlob) {
    return null;
  }

  return new File([resizedBlob], createWebpFileName(file.name, variant.suffix ?? ""), {
    type: resizedBlob.type || MEMO_IMAGE_MIME_TYPE
  });
}

async function createResizedImageFilesFromBitmap(
  file: File,
  variants: MemoImageResizeVariant[]
) {
  if (typeof globalThis.createImageBitmap !== "function") {
    return null;
  }

  const bitmap = await globalThis.createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return null;
  }

  try {
    return Promise.all(
      variants.map((variant) =>
        createResizedImageFileFromSource(file, bitmap, bitmap.width, bitmap.height, variant)
      )
    );
  } finally {
    bitmap.close();
  }
}

async function createResizedImageFilesFromImageElement(
  file: File,
  variants: MemoImageResizeVariant[]
) {
  if (typeof URL.createObjectURL !== "function") {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const imageLoaded = new Promise<HTMLImageElement | null>((resolve) => {
      const timeoutId = globalThis.setTimeout(
        () => resolve(null),
        MEMO_IMAGE_LOAD_TIMEOUT_MS
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

    return Promise.all(
      variants.map((variant) =>
        createResizedImageFileFromSource(
          file,
          loadedImage,
          loadedImage.naturalWidth,
          loadedImage.naturalHeight,
          variant
        )
      )
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createResizedImageFiles(
  file: File,
  variants: MemoImageResizeVariant[]
) {
  if (typeof document === "undefined") {
    return null;
  }

  const bitmapFiles = await createResizedImageFilesFromBitmap(file, variants);
  if (bitmapFiles?.some(Boolean)) {
    return bitmapFiles;
  }

  return createResizedImageFilesFromImageElement(file, variants);
}

async function createResizedImageFile(
  file: File,
  maxEdge: number,
  quality: number,
  suffix = ""
) {
  const [resizedFile] =
    (await createResizedImageFiles(file, [{ maxEdge, quality, suffix }])) ?? [];
  return resizedFile ?? null;
}

export async function compressMemoImage(file: File) {
  if (!isImageFile(file)) {
    return null;
  }
  if (isGifFile(file)) {
    return file;
  }

  return (
    (await createResizedImageFile(file, MEMO_IMAGE_MAX_EDGE, MEMO_IMAGE_QUALITY)) ?? file
  );
}

export async function createMemoImageThumbnail(file: File) {
  if (!isImageFile(file) || isGifFile(file)) {
    return null;
  }

  return createResizedImageFile(
    file,
    MEMO_IMAGE_THUMBNAIL_MAX_EDGE,
    MEMO_IMAGE_THUMBNAIL_QUALITY,
    "-thumb"
  );
}

export async function prepareMemoImageUploadFiles(files: Iterable<File>) {
  const preparedFiles: PreparedMemoImageUploadFile[] = [];

  for (const sourceFile of files) {
    if (!isImageFile(sourceFile)) {
      continue;
    }

    if (isGifFile(sourceFile)) {
      preparedFiles.push({
        sourceFile,
        file: sourceFile,
        thumbnail: null
      });
      continue;
    }

    const [resizedFile, thumbnail] =
      (await createResizedImageFiles(sourceFile, [
        {
          maxEdge: MEMO_IMAGE_MAX_EDGE,
          quality: MEMO_IMAGE_QUALITY
        },
        {
          maxEdge: MEMO_IMAGE_THUMBNAIL_MAX_EDGE,
          quality: MEMO_IMAGE_THUMBNAIL_QUALITY,
          suffix: "-thumb"
        }
      ])) ?? [];

    preparedFiles.push({
      sourceFile,
      file: resizedFile ?? sourceFile,
      thumbnail: thumbnail ?? null
    });
  }

  return preparedFiles;
}
