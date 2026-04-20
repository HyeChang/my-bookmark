export type ExtensionCaptureContext = {
  title: string;
  url: string;
  selectedText: string;
  imageCandidates: string[];
};

export function normalizeSelectionText(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function collectImageCandidates(imageUrls: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      imageUrls
        .map((imageUrl) => imageUrl?.trim() ?? "")
        .filter((imageUrl) => Boolean(imageUrl) && !imageUrl.startsWith("data:"))
    )
  );
}

type DataTransferItemLike = {
  kind?: string;
  type?: string;
  getAsFile?: () => File | null;
};

type DataTransferLike = {
  items?: ArrayLike<DataTransferItemLike> | null;
  files?: ArrayLike<File> | null;
};

export function extractImageFilesFromTransfer(dataTransfer: DataTransferLike | null | undefined) {
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

export async function loadActiveTabCapture(): Promise<ExtensionCaptureContext> {
  const chromeApi = (globalThis as { chrome?: any }).chrome;
  if (!chromeApi?.tabs?.query) {
    return {
      title: "",
      url: "",
      selectedText: "",
      imageCandidates: []
    };
  }

  const [activeTab] = await chromeApi.tabs.query({
    active: true,
    currentWindow: true
  });

  const title = activeTab?.title ?? "";
  const url = activeTab?.url ?? "";

  if (!activeTab?.id || !chromeApi.tabs.sendMessage) {
    return {
      title,
      url,
      selectedText: "",
      imageCandidates: []
    };
  }

  const response = await chromeApi.tabs
    .sendMessage(activeTab.id, {
      type: "bookmark:capture-context"
    })
    .catch(() => null);

  return {
    title: response?.title || title,
    url: response?.url || url,
    selectedText: normalizeSelectionText(response?.selectedText),
    imageCandidates: collectImageCandidates(response?.imageCandidates ?? [])
  };
}

export async function createFileFromImageUrl(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("이미지 후보를 불러오지 못했습니다.");
  }

  const blob = await response.blob();
  const fileName = imageUrl.split("/").pop()?.split("?")[0] || "captured-image.png";
  return new File([blob], fileName, {
    type: blob.type || "image/png"
  });
}
