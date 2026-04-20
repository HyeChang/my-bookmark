import type {
  CreateExtensionTokenResponse,
  ExtensionToken,
  ExtensionTokenListResponse
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";

export async function loadExtensionTokens() {
  const data = await requestJson<Partial<ExtensionTokenListResponse>>(
    "/api/extension-tokens",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "확장 토큰 목록을 불러오지 못했습니다."
    }
  );

  return Array.isArray(data.tokens) ? (data.tokens as ExtensionToken[]) : [];
}

export async function createExtensionToken(label: string) {
  return requestJson<CreateExtensionTokenResponse>(
    "/api/extension-tokens",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ label })
    },
    {
      fallbackMessage: "확장 토큰을 생성하지 못했습니다."
    }
  );
}

export async function revokeExtensionToken(tokenId: string) {
  await requestVoid(
    `/api/extension-tokens/${tokenId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "확장 토큰을 삭제하지 못했습니다."
    }
  );
}
