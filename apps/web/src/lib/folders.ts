import type {
  CreateFolderRequest,
  Folder,
  FolderListResponse,
  FolderResponse
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
