import type {
  AuthenticatedUser,
  ExtensionToken
} from "@bookmark/shared";

type ExtensionTokenRow = {
  id: string;
  user_id: string;
  label: string;
  token_hash: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

type ExtensionTokenAuthRow = ExtensionTokenRow & {
  email: string;
  name: string | null;
  avatar_url: string | null;
};

export type ExtensionTokenRecord = ExtensionToken & {
  userId: string;
  tokenHash: string;
  revokedAt: string | null;
};

export type ExtensionTokenAuthRecord = ExtensionTokenRecord & {
  user: AuthenticatedUser;
};

export type ExtensionTokenRepository = {
  listByUser(userId: string): Promise<ExtensionTokenRecord[]>;
  create(input: {
    userId: string;
    label: string;
  }): Promise<{
    token: ExtensionTokenRecord;
    rawToken: string;
  }>;
  revoke(tokenId: string, userId: string): Promise<boolean>;
  findByRawToken(rawToken: string): Promise<ExtensionTokenAuthRecord | null>;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(rawToken: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  return toHex(new Uint8Array(digest));
}

function createRawToken() {
  return `bmt_${crypto.randomUUID().replaceAll("-", "")}${crypto
    .randomUUID()
    .replaceAll("-", "")}`;
}

function toExtensionTokenRecord(row: ExtensionTokenRow): ExtensionTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at
  };
}

export function toExtensionTokenResponse(token: ExtensionTokenRecord): ExtensionToken {
  return {
    id: token.id,
    label: token.label,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt
  };
}

export function createExtensionTokenRepository(db: D1Database): ExtensionTokenRepository {
  async function getByUserAndId(userId: string, tokenId: string) {
    const row = await db
      .prepare(
        `SELECT
          id,
          user_id,
          label,
          token_hash,
          created_at,
          updated_at,
          revoked_at
        FROM extension_tokens
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, tokenId)
      .first<ExtensionTokenRow>();

    return row ? toExtensionTokenRecord(row) : null;
  }

  return {
    async listByUser(userId) {
      const result = await db
        .prepare(
          `SELECT
            id,
            user_id,
            label,
            token_hash,
            created_at,
            updated_at,
            revoked_at
          FROM extension_tokens
          WHERE user_id = ? AND revoked_at IS NULL
          ORDER BY created_at DESC`
        )
        .bind(userId)
        .all<ExtensionTokenRow>();

      return result.results.map(toExtensionTokenRecord);
    },
    async create(input) {
      const tokenId = crypto.randomUUID();
      const rawToken = createRawToken();
      const tokenHash = await hashToken(rawToken);
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO extension_tokens (
            id,
            user_id,
            label,
            token_hash,
            created_at,
            updated_at,
            revoked_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(tokenId, input.userId, input.label, tokenHash, now, now, null)
        .run();

      const token = await getByUserAndId(input.userId, tokenId);
      if (!token) {
        throw new Error("extension_token_create_failed");
      }

      return { token, rawToken };
    },
    async revoke(tokenId, userId) {
      const now = new Date().toISOString();
      const result = await db
        .prepare(
          `UPDATE extension_tokens
          SET revoked_at = ?,
              updated_at = ?
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL`
        )
        .bind(now, now, tokenId, userId)
        .run();

      return (result.meta.changes ?? 0) > 0;
    },
    async findByRawToken(rawToken) {
      const tokenHash = await hashToken(rawToken);
      const row = await db
        .prepare(
          `SELECT
            extension_tokens.id,
            extension_tokens.user_id,
            extension_tokens.label,
            extension_tokens.token_hash,
            extension_tokens.created_at,
            extension_tokens.updated_at,
            extension_tokens.revoked_at,
            users.email,
            users.name,
            users.avatar_url
          FROM extension_tokens
          INNER JOIN users ON users.id = extension_tokens.user_id
          WHERE extension_tokens.token_hash = ?
            AND extension_tokens.revoked_at IS NULL`
        )
        .bind(tokenHash)
        .first<ExtensionTokenAuthRow>();

      if (!row) {
        return null;
      }

      return {
        ...toExtensionTokenRecord(row),
        user: {
          uid: row.user_id,
          email: row.email,
          name: row.name ?? undefined,
          picture: row.avatar_url ?? undefined
        }
      };
    }
  };
}
