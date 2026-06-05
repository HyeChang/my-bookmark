import type {
  BookmarkResponse,
  CreateBookmarkRequest,
  CreateTagRequest,
  Folder,
  FolderListResponse,
  Tag,
  TagResponse,
  TagListResponse
} from "@bookmark/shared";

const LEGACY_EXTENSION_FOLDER_NAME = "확장";

function buildApiUrl(apiBaseUrl: string, path: string) {
  return `${apiBaseUrl.replace(/\/+$/, "")}${path}`;
}

async function requestJson<T>(
  apiBaseUrl: string,
  token: string,
  path: string,
  init?: RequestInit
) {
  const response = await fetch(buildApiUrl(apiBaseUrl, path), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패 (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function loadExtensionFolders(apiBaseUrl: string, token: string) {
  const data = await requestJson<Partial<FolderListResponse>>(apiBaseUrl, token, "/api/folders");
  return Array.isArray(data.folders)
    ? (data.folders as Folder[]).filter(
        (folder) => folder.name.trim() !== LEGACY_EXTENSION_FOLDER_NAME
      )
    : [];
}

export async function ensureExtensionFolderId(
  apiBaseUrl: string,
  token: string,
  preferredFolderId?: string | null,
  availableFolders?: Folder[]
) {
  const normalizedPreferredFolderId = preferredFolderId?.trim() ?? "";
  if (!normalizedPreferredFolderId) {
    return null;
  }

  const folders = availableFolders ?? (await loadExtensionFolders(apiBaseUrl, token));
  if (folders.some((folder) => folder.id === normalizedPreferredFolderId)) {
    return normalizedPreferredFolderId;
  }

  return null;
}

export async function loadExtensionTags(apiBaseUrl: string, token: string) {
  const data = await requestJson<Partial<TagListResponse>>(apiBaseUrl, token, "/api/tags");
  return Array.isArray(data.tags) ? (data.tags as Tag[]) : [];
}

export async function createExtensionTag(
  apiBaseUrl: string,
  token: string,
  payload: CreateTagRequest
) {
  const data = await requestJson<TagResponse>(apiBaseUrl, token, "/api/tags", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return data.tag;
}

export async function createExtensionBookmark(
  apiBaseUrl: string,
  token: string,
  payload: CreateBookmarkRequest
) {
  const data = await requestJson<BookmarkResponse>(apiBaseUrl, token, "/api/bookmarks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return data.bookmark;
}

export async function saveExtensionBookmark(
  apiBaseUrl: string,
  token: string,
  payload: CreateBookmarkRequest,
  files: File[],
  availableFolders?: Folder[]
) {
  const folderId = await ensureExtensionFolderId(
    apiBaseUrl,
    token,
    payload.folderId ?? null,
    availableFolders
  );
  const bookmark = await createExtensionBookmark(apiBaseUrl, token, {
    ...payload,
    folderId
  });

  for (const file of files) {
    await uploadExtensionBookmarkAsset(apiBaseUrl, token, bookmark.id, file);
  }

  return bookmark;
}

export async function uploadExtensionBookmarkAsset(
  apiBaseUrl: string,
  token: string,
  bookmarkId: string,
  file: File
) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(buildApiUrl(apiBaseUrl, `/api/bookmarks/${bookmarkId}/assets`), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }
}
