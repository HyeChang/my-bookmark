import type {
  MemoAsset,
  MemoAssetListResponse,
  MemoAssetResponse
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";
import type { PreparedMemoImageUploadFile } from "./memo-image-compression";

function mapMemoAssetErrorCode(errorCode: string) {
  switch (errorCode) {
    case "missing_file":
    case "empty_file":
      return "업로드할 이미지를 선택해주세요.";
    case "unsupported_file_type":
    case "unsupported_thumbnail_type":
      return "지원하지 않는 이미지 형식입니다.";
    case "file_too_large":
    case "thumbnail_too_large":
      return "이미지 파일 크기가 너무 큽니다.";
    case "memo_not_found":
      return "메모를 찾지 못했습니다.";
    case "memo_asset_not_found":
      return "메모 이미지를 찾지 못했습니다.";
    default:
      return null;
  }
}

export async function loadMemoAssets(memoId: string) {
  const data = await requestJson<Partial<MemoAssetListResponse>>(
    `/api/memos/${memoId}/assets`,
    {
      credentials: "include"
    },
    {
      fallbackMessage: "메모 이미지를 불러오지 못했습니다.",
      mapErrorCode: mapMemoAssetErrorCode
    }
  );
  return Array.isArray(data.assets) ? (data.assets as MemoAsset[]) : [];
}

export async function uploadPreparedMemoAsset(
  memoId: string,
  preparedFile: PreparedMemoImageUploadFile
) {
  const formData = new FormData();
  formData.set("file", preparedFile.file);
  if (preparedFile.thumbnail) {
    formData.set("thumbnail", preparedFile.thumbnail);
  }

  const data = await requestJson<MemoAssetResponse>(
    `/api/memos/${memoId}/assets`,
    {
      method: "POST",
      credentials: "include",
      body: formData
    },
    {
      fallbackMessage: "메모 이미지를 업로드하지 못했습니다.",
      mapErrorCode: mapMemoAssetErrorCode
    }
  );
  return data.asset;
}

export async function uploadMemoAsset(memoId: string, file: File) {
  const { prepareMemoImageUploadFiles } = await import("./memo-image-compression");
  const [preparedFile] = await prepareMemoImageUploadFiles([file]);
  if (!preparedFile) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  return uploadPreparedMemoAsset(memoId, preparedFile);
}

export async function deleteMemoAsset(memoId: string, assetId: string) {
  await requestVoid(
    `/api/memos/${memoId}/assets/${assetId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "메모 이미지를 삭제하지 못했습니다.",
      mapErrorCode: mapMemoAssetErrorCode
    }
  );
}
