import type {
  CreateMemoFolderRequest,
  CreateMemoRequest,
  CreateMemoTagRequest,
  Memo,
  MemoCounts,
  MemoCountsResponse,
  MemoFolder,
  MemoFolderListResponse,
  MemoFolderResponse,
  MemoListResponse,
  MemoLockPasswordRequest,
  MemoLockResponse,
  MemoLockStatusResponse,
  MemoResponse,
  MemoSortMode,
  MemoTag,
  MemoTagListResponse,
  MemoTagResponse,
  MemoWorkspaceResponse,
  MoveMemoFolderRequest,
  ReorderMemoFoldersRequest,
  UpdateMemoFolderRequest,
  UpdateMemoRequest,
  UpdateMemoTagRequest
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";

type LoadMemoPageOptions = {
  query?: string;
  folderId?: string | null;
  includeDescendantFolders?: boolean;
  tagId?: string;
  favorite?: boolean;
  includeHidden?: boolean;
  includeLocked?: boolean;
  sort?: MemoSortMode;
  limit?: number;
  offset?: number;
};

const emptyMemoCountBucket = {
  total: 0,
  visible: 0
};

export type MemoPage = {
  memos: Memo[];
  pagination: NonNullable<MemoListResponse["pagination"]> | null;
};

function normalizeMemoCountBucket(value: unknown) {
  if (!value || typeof value !== "object") {
    return { ...emptyMemoCountBucket };
  }

  const bucket = value as Partial<{ total: number; visible: number }>;
  return {
    total: Number.isFinite(bucket.total) ? Math.max(0, Math.trunc(bucket.total ?? 0)) : 0,
    visible: Number.isFinite(bucket.visible) ? Math.max(0, Math.trunc(bucket.visible ?? 0)) : 0
  };
}

function normalizeMemoCounts(counts: Partial<MemoCounts> | undefined): MemoCounts {
  const byFolderId: MemoCounts["byFolderId"] = {};
  const rawFolderCounts = counts?.byFolderId;

  if (rawFolderCounts && typeof rawFolderCounts === "object") {
    for (const [folderId, bucket] of Object.entries(rawFolderCounts)) {
      byFolderId[folderId] = normalizeMemoCountBucket(bucket);
    }
  }

  return {
    active: normalizeMemoCountBucket(counts?.active),
    favorite: normalizeMemoCountBucket(counts?.favorite),
    unfiled: normalizeMemoCountBucket(counts?.unfiled),
    byFolderId
  };
}

function mapMemoErrorCode(errorCode: string) {
  switch (errorCode) {
    case "invalid_content_json":
      return "메모 내용을 다시 확인해주세요.";
    case "invalid_content_text":
      return "메모 본문을 다시 확인해주세요.";
    case "invalid_folder_id":
    case "invalid_parent_folder_id":
      return "선택한 폴더를 찾지 못했습니다.";
    case "invalid_folder_reorder":
      return "메모 폴더 순서를 다시 확인해주세요.";
    case "invalid_tag_ids":
      return "선택한 태그를 다시 확인해주세요.";
    case "missing_folder_name":
      return "폴더 이름을 입력해주세요.";
    case "missing_tag_name":
      return "태그 이름을 입력해주세요.";
    case "memo_not_found":
      return "메모를 찾지 못했습니다.";
    case "memo_folder_not_found":
      return "메모 폴더를 찾지 못했습니다.";
    case "memo_tag_not_found":
      return "메모 태그를 찾지 못했습니다.";
    case "invalid_memo_lock_password":
      return "메모 잠금 비밀번호를 다시 확인해주세요.";
    case "memo_lock_already_configured":
      return "이미 메모 잠금 비밀번호가 설정되어 있습니다.";
    case "memo_lock_required":
      return "잠금 메모를 보려면 메모 잠금을 해제해주세요.";
    case "memo_lock_repository_unavailable":
      return "메모 잠금 기능을 사용할 수 없습니다.";
    default:
      return null;
  }
}

function buildMemoListUrl(options: LoadMemoPageOptions = {}) {
  const searchParams = new URLSearchParams();
  const query = options.query?.trim();
  const folderId = typeof options.folderId === "string" ? options.folderId.trim() : null;
  const tagId = options.tagId?.trim();

  if (query) {
    searchParams.set("query", query);
  }
  if (options.folderId === null) {
    searchParams.set("folderId", "null");
  } else if (folderId) {
    searchParams.set("folderId", folderId);
    if (options.includeDescendantFolders) {
      searchParams.set("includeDescendantFolders", "1");
    }
  }
  if (tagId) {
    searchParams.set("tagId", tagId);
  }
  if (options.favorite === true) {
    searchParams.set("favorite", "1");
  } else if (options.favorite === false) {
    searchParams.set("favorite", "0");
  }
  if (options.includeHidden) {
    searchParams.set("includeHidden", "1");
  }
  if (options.includeLocked) {
    searchParams.set("includeLocked", "1");
  }
  if (options.sort && options.sort !== "updated_desc") {
    searchParams.set("sort", options.sort);
  }
  if (Number.isFinite(options.limit)) {
    searchParams.set("limit", String(Math.max(1, Math.trunc(options.limit ?? 1))));
    searchParams.set("offset", String(Math.max(0, Math.trunc(options.offset ?? 0))));
  }

  return searchParams.size > 0 ? `/api/memos?${searchParams.toString()}` : "/api/memos";
}

function normalizeMemoPagination(
  pagination: Partial<NonNullable<MemoListResponse["pagination"]>> | undefined
) {
  if (
    !pagination ||
    !Number.isFinite(pagination.limit) ||
    !Number.isFinite(pagination.offset) ||
    !Number.isFinite(pagination.total)
  ) {
    return null;
  }

  return {
    limit: Math.max(1, Math.trunc(pagination.limit ?? 1)),
    offset: Math.max(0, Math.trunc(pagination.offset ?? 0)),
    total: Math.max(0, Math.trunc(pagination.total ?? 0)),
    hasMore: pagination.hasMore === true
  };
}

export async function loadMemoLockStatus() {
  return requestJson<MemoLockStatusResponse>(
    "/api/memos/lock/status",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 잠금 상태를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
}

export async function loadMemoWorkspace() {
  const data = await requestJson<Partial<MemoWorkspaceResponse>>(
    "/api/memos/workspace",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 초기 정보를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );

  return {
    lockStatus: {
      isConfigured: data.lockStatus?.isConfigured === true,
      isUnlocked: data.lockStatus?.isUnlocked === true
    },
    folders: Array.isArray(data.folders) ? (data.folders as MemoFolder[]) : [],
    tags: Array.isArray(data.tags) ? (data.tags as MemoTag[]) : [],
    counts: normalizeMemoCounts(data.counts)
  };
}

async function submitMemoLockPassword(
  path: string,
  input: MemoLockPasswordRequest,
  fallbackMessage: string
) {
  return requestJson<MemoLockResponse>(
    path,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage,
      mapErrorCode: mapMemoErrorCode
    }
  );
}

export async function setupMemoLock(password: string) {
  return submitMemoLockPassword(
    "/api/memos/lock/setup",
    { password },
    "메모 잠금 비밀번호를 설정하지 못했습니다."
  );
}

export async function unlockMemoLock(password: string) {
  return submitMemoLockPassword(
    "/api/memos/lock/unlock",
    { password },
    "메모 잠금을 해제하지 못했습니다."
  );
}

export async function unlockLockedMemo(memoId: string, password: string) {
  return submitMemoLockPassword(
    `/api/memos/${memoId}/lock/unlock`,
    { password },
    "잠금 메모를 해제하지 못했습니다."
  );
}

export async function lockMemo() {
  return requestJson<MemoLockResponse>(
    "/api/memos/lock/lock",
    {
      method: "POST",
      credentials: "include"
    },
    {
      fallbackMessage: "메모를 잠그지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
}

export async function lockLockedMemo(memoId: string) {
  return requestJson<MemoLockResponse>(
    `/api/memos/${memoId}/lock/lock`,
    {
      method: "POST",
      credentials: "include"
    },
    {
      fallbackMessage: "잠금 메모를 다시 잠그지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
}

export async function loadMemoPage(options: LoadMemoPageOptions = {}): Promise<MemoPage> {
  const data = await requestJson<Partial<MemoListResponse>>(
    buildMemoListUrl(options),
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );

  return {
    memos: Array.isArray(data.memos) ? (data.memos as Memo[]) : [],
    pagination: normalizeMemoPagination(data.pagination)
  };
}

export async function loadMemoCounts() {
  const data = await requestJson<Partial<MemoCountsResponse>>(
    "/api/memos/counts",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 개수를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );

  return normalizeMemoCounts(data.counts);
}

export async function loadMemo(memoId: string) {
  const data = await requestJson<MemoResponse>(
    `/api/memos/${memoId}`,
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 상세 정보를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.memo;
}

export async function createMemo(input: CreateMemoRequest) {
  const data = await requestJson<MemoResponse>(
    "/api/memos",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모를 저장하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.memo;
}

export async function updateMemo(memoId: string, input: UpdateMemoRequest) {
  const data = await requestJson<MemoResponse>(
    `/api/memos/${memoId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모를 수정하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.memo;
}

export async function deleteMemo(memoId: string) {
  await requestVoid(
    `/api/memos/${memoId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "메모를 삭제하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
}

export async function loadMemoFolders() {
  const data = await requestJson<Partial<MemoFolderListResponse>>(
    "/api/memos/folders",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 폴더를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return Array.isArray(data.folders) ? (data.folders as MemoFolder[]) : [];
}

export async function createMemoFolder(input: CreateMemoFolderRequest) {
  const data = await requestJson<MemoFolderResponse>(
    "/api/memos/folders",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모 폴더를 저장하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.folder;
}

export async function updateMemoFolder(
  folderId: string,
  input: UpdateMemoFolderRequest
) {
  const data = await requestJson<MemoFolderResponse>(
    `/api/memos/folders/${folderId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모 폴더를 수정하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.folder;
}

export async function deleteMemoFolder(folderId: string) {
  await requestVoid(
    `/api/memos/folders/${folderId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "메모 폴더를 삭제하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
}

export async function reorderMemoFolders(input: ReorderMemoFoldersRequest) {
  const data = await requestJson<Partial<MemoFolderListResponse>>(
    "/api/memos/folders/reorder",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모 폴더 순서를 저장하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return Array.isArray(data.folders) ? (data.folders as MemoFolder[]) : [];
}

export async function moveMemoFolder(folderId: string, input: MoveMemoFolderRequest) {
  const data = await requestJson<Partial<MemoFolderListResponse>>(
    `/api/memos/folders/${folderId}/move`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모 폴더 부모를 변경하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return Array.isArray(data.folders) ? (data.folders as MemoFolder[]) : [];
}

export async function loadMemoTags() {
  const data = await requestJson<Partial<MemoTagListResponse>>(
    "/api/memos/tags",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 태그를 불러오지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return Array.isArray(data.tags) ? (data.tags as MemoTag[]) : [];
}

export async function createMemoTag(input: CreateMemoTagRequest) {
  const data = await requestJson<MemoTagResponse>(
    "/api/memos/tags",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모 태그를 저장하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.tag;
}

export async function updateMemoTag(tagId: string, input: UpdateMemoTagRequest) {
  const data = await requestJson<MemoTagResponse>(
    `/api/memos/tags/${tagId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "메모 태그를 수정하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
  return data.tag;
}

export async function deleteMemoTag(tagId: string) {
  await requestVoid(
    `/api/memos/tags/${tagId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "메모 태그를 삭제하지 못했습니다.",
      mapErrorCode: mapMemoErrorCode
    }
  );
}
