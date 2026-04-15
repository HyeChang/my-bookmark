import type {
  CreateFolderRequest,
  Folder,
  FolderListResponse,
  FolderResponse,
  MoveFolderRequest,
  ReorderFoldersRequest,
  UpdateFolderRequest
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";

function mapFolderErrorCode(errorCode: string) {
  switch (errorCode) {
    case "missing_folder_name":
      return "폴더 이름을 입력해주세요.";
    case "invalid_parent_folder_id":
      return "선택한 부모 폴더를 찾지 못했습니다.";
    case "invalid_parent_folder_cycle":
      return "폴더를 자기 자신 또는 하위 폴더 아래로 이동할 수 없습니다.";
    case "folder_not_found":
      return "폴더를 찾지 못했습니다.";
    default:
      return null;
  }
}

export async function loadFolders() {
  const data = await requestJson<Partial<FolderListResponse>>(
    "/api/folders",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "폴더를 불러오지 못했습니다."
    }
  );
  return Array.isArray(data.folders) ? (data.folders as Folder[]) : [];
}

export async function createFolder(input: CreateFolderRequest) {
  const data = await requestJson<FolderResponse>(
    "/api/folders",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "폴더를 저장하지 못했습니다.",
      mapErrorCode: mapFolderErrorCode
    }
  );
  return data.folder;
}

export async function updateFolder(folderId: string, input: UpdateFolderRequest) {
  const data = await requestJson<FolderResponse>(
    `/api/folders/${folderId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "폴더를 수정하지 못했습니다.",
      mapErrorCode: mapFolderErrorCode
    }
  );
  return data.folder;
}

export async function deleteFolder(folderId: string) {
  await requestVoid(
    `/api/folders/${folderId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "폴더를 삭제하지 못했습니다.",
      mapErrorCode: mapFolderErrorCode
    }
  );
}

export async function reorderFolders(input: ReorderFoldersRequest) {
  const data = await requestJson<Partial<FolderListResponse>>(
    "/api/folders/reorder",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "폴더 순서를 저장하지 못했습니다.",
      mapErrorCode: mapFolderErrorCode
    }
  );
  return Array.isArray(data.folders) ? (data.folders as Folder[]) : [];
}

export async function moveFolder(folderId: string, input: MoveFolderRequest) {
  const data = await requestJson<Partial<FolderListResponse>>(
    `/api/folders/${folderId}/move`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "폴더 부모를 변경하지 못했습니다.",
      mapErrorCode: mapFolderErrorCode
    }
  );
  return Array.isArray(data.folders) ? (data.folders as Folder[]) : [];
}
