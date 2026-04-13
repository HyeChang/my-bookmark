import type { AuthenticatedUser } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const SESSION_COOKIE_NAME = "bookmark_session";
export const DEFAULT_SESSION_SECRET = "dev-session-secret";

function toBase64Url(input: Uint8Array) {
  let binary = "";
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const binary = atob(normalized + "=".repeat(padding));
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(value)
  );

  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionValue(
  user: AuthenticatedUser,
  secret: string
) {
  const payload = {
    user
  };
  const encodedPayload = toBase64Url(
    textEncoder.encode(JSON.stringify(payload))
  );
  const signature = await sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export async function readSessionValue(
  sessionValue: string | undefined,
  secret: string
) {
  if (!sessionValue) {
    return null;
  }

  const [encodedPayload, providedSignature] = sessionValue.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload, secret);
  if (expectedSignature !== providedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(textDecoder.decode(fromBase64Url(encodedPayload))) as {
      user: AuthenticatedUser;
    };

    return payload.user;
  } catch {
    return null;
  }
}
