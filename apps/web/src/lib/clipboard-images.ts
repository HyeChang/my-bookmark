type DataTransferItemLike = {
  kind?: string;
  type?: string;
  getAsFile?: () => File | null;
};

type DataTransferLike = {
  items?: ArrayLike<DataTransferItemLike> | null;
  files?: ArrayLike<File> | null;
};

export function extractImageFilesFromDataTransfer(dataTransfer: DataTransferLike | null | undefined) {
  if (!dataTransfer) {
    return [];
  }

  const itemFiles = Array.from(dataTransfer.items ?? []).flatMap((item) => {
    if (item.kind !== "file" || typeof item.getAsFile !== "function") {
      return [];
    }

    const file = item.getAsFile();
    if (!file || !file.type.startsWith("image/")) {
      return [];
    }

    return [file];
  });

  if (itemFiles.length > 0) {
    return itemFiles;
  }

  return Array.from(dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/"));
}
