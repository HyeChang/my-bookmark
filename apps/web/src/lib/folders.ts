import type {
  CreateFolderRequest,
  Folder,
  FolderListResponse,
  FolderResponse,
  MoveFolderRequest,
  ReorderFoldersRequest,
  UpdateFolderRequest
} from "@bookmark/shared";

export async function loadFolders() {
  const res = await fetch("/api/folders", {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load folders");
  }

  const data = (await res.json()) as Partial<FolderListResponse>;
  return Array.isArray(data.folders) ? (data.folders as Folder[]) : [];
}

export async function createFolder(input: CreateFolderRequest) {
  const res = await fetch("/api/folders", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to create folder");
  }

  const data = (await res.json()) as FolderResponse;
  return data.folder;
}

export async function updateFolder(folderId: string, input: UpdateFolderRequest) {
  const res = await fetch(`/api/folders/${folderId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to update folder");
  }

  const data = (await res.json()) as FolderResponse;
  return data.folder;
}

export async function deleteFolder(folderId: string) {
  const res = await fetch(`/api/folders/${folderId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to delete folder");
  }
}

export async function reorderFolders(input: ReorderFoldersRequest) {
  const res = await fetch("/api/folders/reorder", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to reorder folders");
  }

  const data = (await res.json()) as Partial<FolderListResponse>;
  return Array.isArray(data.folders) ? (data.folders as Folder[]) : [];
}

export async function moveFolder(folderId: string, input: MoveFolderRequest) {
  const res = await fetch(`/api/folders/${folderId}/move`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to move folder");
  }

  const data = (await res.json()) as Partial<FolderListResponse>;
  return Array.isArray(data.folders) ? (data.folders as Folder[]) : [];
}
