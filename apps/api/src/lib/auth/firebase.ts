import {
  decodeProtectedHeader,
  importX509,
  jwtVerify,
  type JWTPayload
} from "jose";

import type { AuthenticatedUser, VerifyIdToken } from "./types";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

type FirebaseTokenPayload = JWTPayload & {
  email?: string;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
  sub?: string;
};

let certificatesCache:
  | {
      certs: Record<string, string>;
      expiresAt: number;
    }
  | undefined;

function parseCacheDuration(cacheControl: string | null) {
  const match = cacheControl?.match(/max-age=(\d+)/);
  if (!match) {
    return 60 * 60;
  }

  return Number(match[1]);
}

async function getFirebaseCertificates(fetchImpl: typeof fetch) {
  if (certificatesCache && Date.now() < certificatesCache.expiresAt) {
    return certificatesCache.certs;
  }

  const res = await fetchImpl(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new Error("firebase_certs_fetch_failed");
  }

  const certs = (await res.json()) as Record<string, string>;
  const ttlSeconds = parseCacheDuration(res.headers.get("cache-control"));

  certificatesCache = {
    certs,
    expiresAt: Date.now() + ttlSeconds * 1000
  };

  return certs;
}

export function payloadToAuthenticatedUser(
  payload: FirebaseTokenPayload,
  projectId: string
): AuthenticatedUser {
  if (payload.aud !== projectId) {
    throw new Error("invalid_firebase_audience");
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("invalid_firebase_issuer");
  }

  if (!payload.sub) {
    throw new Error("invalid_firebase_subject");
  }

  if (!payload.email) {
    throw new Error("invalid_firebase_email");
  }

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture
  };
}

export function createFirebaseVerifier(options?: {
  fetchImpl?: typeof fetch;
}): VerifyIdToken {
  const fetchImpl = options?.fetchImpl ?? fetch;

  return async (idToken, projectId) => {
    if (!projectId) {
      throw new Error("missing_firebase_project_id");
    }

    const header = decodeProtectedHeader(idToken);
    if (header.alg !== "RS256" || !header.kid) {
      throw new Error("invalid_firebase_token_header");
    }

    const certs = await getFirebaseCertificates(fetchImpl);
    const certificate = certs[header.kid];
    if (!certificate) {
      throw new Error("missing_firebase_certificate");
    }

    const key = await importX509(certificate, "RS256");
    const { payload } = await jwtVerify(idToken, key, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId
    });

    return payloadToAuthenticatedUser(payload as FirebaseTokenPayload, projectId);
  };
}
