type RequestJsonOptions = {
  fallbackMessage: string;
  mapErrorCode?: (errorCode: string) => string | null;
};

const localNetworkErrorMessage =
  "로컬 서버에 연결하지 못했습니다. 실행 중인지 확인해주세요.";
const deployedNetworkErrorMessage =
  "서버에 연결하지 못했습니다. 네트워크 상태 또는 배포 주소를 확인해주세요.";

function getNetworkErrorMessage() {
  const hostname = globalThis.location?.hostname?.trim().toLowerCase() ?? "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  ) {
    return localNetworkErrorMessage;
  }

  return deployedNetworkErrorMessage;
}

async function parseErrorCode(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" ? payload.error : null;
}

function normalizeRequestError(error: unknown) {
  if (error instanceof Error) {
    const normalizedMessage = error.message.trim().toLowerCase();
    if (
      error instanceof TypeError ||
      normalizedMessage.includes("failed to fetch") ||
      normalizedMessage.includes("networkerror") ||
      normalizedMessage.includes("load failed")
    ) {
      return new Error(getNetworkErrorMessage());
    }
  }

  return error instanceof Error ? error : new Error(getNetworkErrorMessage());
}

export async function requestJson<TResponse>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: RequestJsonOptions
) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    throw normalizeRequestError(error);
  }

  if (!response.ok) {
    const errorCode = await parseErrorCode(response);
    const mappedMessage = errorCode ? options.mapErrorCode?.(errorCode) : null;
    throw new Error(mappedMessage ?? options.fallbackMessage);
  }

  return (await response.json()) as TResponse;
}

export async function requestVoid(
  input: RequestInfo | URL,
  init: RequestInit,
  options: RequestJsonOptions
) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    throw normalizeRequestError(error);
  }

  if (!response.ok) {
    const errorCode = await parseErrorCode(response);
    const mappedMessage = errorCode ? options.mapErrorCode?.(errorCode) : null;
    throw new Error(mappedMessage ?? options.fallbackMessage);
  }
}
