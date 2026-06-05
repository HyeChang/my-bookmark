export type ExtensionFastSaveMode = "popup" | "immediate";
export type PendingBookmarkAsset = {
  kind: "remote-url" | "data-url";
  source: string;
  filename: string;
};
export type PendingBookmarkDraftSource = "page" | "selection" | "image" | "link" | "screenshot";
export type PendingBookmarkDraft = {
  source: PendingBookmarkDraftSource;
  title: string;
  url: string;
  userContent: string;
  folderId: string;
  tagIds: string[];
  assets: PendingBookmarkAsset[];
};

export type ExtensionSettings = {
  apiBaseUrl: string;
  token: string;
  defaultFolderId: string;
  defaultTagIds: string[];
  fastSaveMode: ExtensionFastSaveMode;
};

const STORAGE_KEY = "extensionSettings";
const PENDING_DRAFT_KEY = "extensionPendingBookmarkDraft";
type ChromeStorageArea = {
  get?: (key: string) => Promise<Record<string, unknown>>;
  set?: (value: Record<string, unknown>) => Promise<void>;
  remove?: (key: string) => Promise<void>;
};

export const defaultExtensionSettings: ExtensionSettings = {
  apiBaseUrl: "",
  token: "",
  defaultFolderId: "",
  defaultTagIds: [],
  fastSaveMode: "popup"
};

function getChromeStorageLocal() {
  return (globalThis as { chrome?: { storage?: { local?: ChromeStorageArea } } }).chrome?.storage?.local;
}

function getChromeStorageSync() {
  return (globalThis as { chrome?: { storage?: { sync?: ChromeStorageArea } } }).chrome?.storage?.sync;
}

function normalizeBaseUrl(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function normalizeSettings(value: Partial<ExtensionSettings> | null | undefined): ExtensionSettings {
  return {
    apiBaseUrl: normalizeBaseUrl(value?.apiBaseUrl) || defaultExtensionSettings.apiBaseUrl,
    token: (value?.token ?? "").trim(),
    defaultFolderId: (value?.defaultFolderId ?? "").trim(),
    defaultTagIds: Array.from(
      new Set((value?.defaultTagIds ?? []).map((tagId) => tagId.trim()).filter(Boolean))
    ),
    fastSaveMode: value?.fastSaveMode === "immediate" ? "immediate" : "popup"
  };
}

function normalizePendingBookmarkAsset(
  value: Partial<PendingBookmarkAsset> | null | undefined
): PendingBookmarkAsset | null {
  const kind = value?.kind === "data-url" ? "data-url" : value?.kind === "remote-url" ? "remote-url" : null;
  const source = (value?.source ?? "").trim();
  const filename = (value?.filename ?? "").trim();

  if (!kind || !source || !filename) {
    return null;
  }

  return {
    kind,
    source,
    filename
  };
}

function normalizePendingBookmarkDraft(
  value: Partial<PendingBookmarkDraft> | null | undefined
): PendingBookmarkDraft | null {
  const source =
    value?.source === "page" ||
    value?.source === "selection" ||
    value?.source === "image" ||
    value?.source === "link" ||
    value?.source === "screenshot"
      ? value.source
      : null;
  const url = (value?.url ?? "").trim();

  if (!source || !url) {
    return null;
  }

  return {
    source,
    title: (value?.title ?? "").trim(),
    url,
    userContent: (value?.userContent ?? "").trim(),
    folderId: (value?.folderId ?? "").trim(),
    tagIds: Array.from(
      new Set((value?.tagIds ?? []).map((tagId) => tagId.trim()).filter(Boolean))
    ),
    assets: (value?.assets ?? [])
      .map((asset) => normalizePendingBookmarkAsset(asset))
      .filter((asset): asset is PendingBookmarkAsset => asset !== null)
  };
}

export function parseDefaultTagIdsInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tagId) => tagId.trim())
        .filter(Boolean)
    )
  );
}

export function formatDefaultTagIdsInput(tagIds: string[]) {
  return tagIds.join(", ");
}

export async function loadExtensionSettings() {
  const localStorage = getChromeStorageLocal();
  const syncStorage = getChromeStorageSync();

  if (localStorage?.get) {
    const localStored = await localStorage.get(STORAGE_KEY).catch(() => ({}));
    if (Object.prototype.hasOwnProperty.call(localStored, STORAGE_KEY)) {
      return normalizeSettings(localStored[STORAGE_KEY] as Partial<ExtensionSettings> | undefined);
    }
  }

  if (syncStorage?.get) {
    const syncStored = await syncStorage.get(STORAGE_KEY).catch(() => ({}));
    if (Object.prototype.hasOwnProperty.call(syncStored, STORAGE_KEY)) {
      const settings = normalizeSettings(
        syncStored[STORAGE_KEY] as Partial<ExtensionSettings> | undefined
      );
      await localStorage?.set?.({ [STORAGE_KEY]: settings }).catch(() => undefined);
      return settings;
    }
  }

  return defaultExtensionSettings;
}

export async function saveExtensionSettings(settings: ExtensionSettings) {
  const localStorage = getChromeStorageLocal();
  const syncStorage = getChromeStorageSync();
  const normalizedSettings = normalizeSettings(settings);

  const localWrite = localStorage?.set
    ? localStorage.set({ [STORAGE_KEY]: normalizedSettings })
    : Promise.resolve();
  const syncWrite = syncStorage?.set
    ? syncStorage.set({ [STORAGE_KEY]: normalizedSettings }).catch(() => undefined)
    : Promise.resolve();

  await localWrite;
  await syncWrite;
}

export async function loadPendingBookmarkDraft() {
  const storage = getChromeStorageLocal();
  if (!storage?.get) {
    return null;
  }

  const stored = await storage.get(PENDING_DRAFT_KEY).catch(() => ({}));
  return normalizePendingBookmarkDraft(stored[PENDING_DRAFT_KEY] as Partial<PendingBookmarkDraft> | undefined);
}

export async function savePendingBookmarkDraft(draft: PendingBookmarkDraft) {
  const storage = getChromeStorageLocal();
  if (!storage?.set) {
    return;
  }

  const normalizedDraft = normalizePendingBookmarkDraft(draft);
  if (!normalizedDraft) {
    return;
  }

  await storage.set({
    [PENDING_DRAFT_KEY]: normalizedDraft
  });
}

export async function clearPendingBookmarkDraft() {
  const storage = getChromeStorageLocal();
  if (!storage?.remove) {
    return;
  }

  await storage.remove(PENDING_DRAFT_KEY);
}
