import type {
  CreateTagRequest,
  Tag,
  TagListResponse,
  TagResponse,
  UpdateTagRequest
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";

function mapTagErrorCode(errorCode: string) {
  switch (errorCode) {
    case "missing_tag_name":
      return "태그 이름을 입력해주세요.";
    case "tag_not_found":
      return "태그를 찾지 못했습니다.";
    default:
      return null;
  }
}

export async function loadTags() {
  const data = await requestJson<Partial<TagListResponse>>(
    "/api/tags",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "태그를 불러오지 못했습니다.",
      mapErrorCode: mapTagErrorCode
    }
  );
  return Array.isArray(data.tags) ? (data.tags as Tag[]) : [];
}

export async function createTag(input: CreateTagRequest) {
  const data = await requestJson<TagResponse>(
    "/api/tags",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "태그를 저장하지 못했습니다.",
      mapErrorCode: mapTagErrorCode
    }
  );
  return data.tag;
}

export async function updateTag(tagId: string, input: UpdateTagRequest) {
  const data = await requestJson<TagResponse>(
    `/api/tags/${tagId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "태그를 수정하지 못했습니다.",
      mapErrorCode: mapTagErrorCode
    }
  );
  return data.tag;
}

export async function deleteTag(tagId: string) {
  await requestVoid(
    `/api/tags/${tagId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "태그를 삭제하지 못했습니다.",
      mapErrorCode: mapTagErrorCode
    }
  );
}
