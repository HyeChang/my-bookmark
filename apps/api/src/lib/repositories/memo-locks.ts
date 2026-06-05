type MemoLockSettingRow = {
  user_id: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
};

type MemoLockSessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

type MemoItemLockSettingRow = {
  memo_id: string;
  user_id: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
};

type MemoItemLockSessionRow = {
  id: string;
  memo_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

export type MemoLockStatus = {
  isConfigured: boolean;
};

export type MemoLockSettingRecord = {
  userId: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoLockSession = {
  id: string;
  rawToken: string;
  expiresAt: string;
};

export type MemoItemLockSettingRecord = {
  memoId: string;
  userId: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoLockRepository = {
  getStatus(userId: string): Promise<MemoLockStatus>;
  setupPassword(userId: string, password: string): Promise<MemoLockSettingRecord | null>;
  verifyPassword(userId: string, password: string): Promise<boolean>;
  createUnlockSession(userId: string, ttlMs: number): Promise<MemoLockSession>;
  verifyUnlockSession(userId: string, sessionId: string, rawToken: string): Promise<boolean>;
  revokeUnlockSession(userId: string, sessionId: string): Promise<boolean>;
  revokeExpiredSessions(userId: string): Promise<void>;
  getMemoStatus(userId: string, memoId: string): Promise<MemoLockStatus>;
  setMemoPassword(
    userId: string,
    memoId: string,
    password: string
  ): Promise<void>;
  deleteMemoPassword(userId: string, memoId: string): Promise<boolean>;
  verifyMemoPassword(userId: string, memoId: string, password: string): Promise<boolean>;
  createMemoUnlockSession(
    userId: string,
    memoId: string,
    ttlMs: number
  ): Promise<MemoLockSession>;
  verifyMemoUnlockSession(
    userId: string,
    memoId: string,
    sessionId: string,
    rawToken: string
  ): Promise<boolean>;
  revokeMemoUnlockSession(
    userId: string,
    memoId: string,
    sessionId: string
  ): Promise<boolean>;
  revokeMemoUnlockSessions(userId: string, memoId: string): Promise<void>;
  revokeExpiredMemoSessions(userId: string): Promise<void>;
};

const textEncoder = new TextEncoder();
// Cloudflare Workers rejects PBKDF2 iteration counts above 100,000.
export const MEMO_LOCK_PBKDF2_ITERATIONS = 100_000;
const MEMO_LOCK_SALT_BYTES = 16;
const MEMO_LOCK_TOKEN_BYTES = 32;

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

function createRandomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

async function derivePasswordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64Url(salt),
      iterations: MEMO_LOCK_PBKDF2_ITERATIONS
    },
    key,
    256
  );

  return toBase64Url(new Uint8Array(bits));
}

export async function hashMemoLockPassword(password: string) {
  const salt = createRandomBase64Url(MEMO_LOCK_SALT_BYTES);
  const passwordHash = await derivePasswordHash(password, salt);

  return {
    passwordHash,
    salt
  };
}

export async function verifyMemoLockPassword(
  password: string,
  passwordHash: string,
  salt: string
) {
  const nextPasswordHash = await derivePasswordHash(password, salt);
  return constantTimeEqual(nextPasswordHash, passwordHash);
}

async function hashMemoLockToken(rawToken: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(rawToken));
  return toBase64Url(new Uint8Array(digest));
}

function toMemoLockSettingRecord(row: MemoLockSettingRow): MemoLockSettingRecord {
  return {
    userId: row.user_id,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toMemoItemLockSettingRecord(
  row: MemoItemLockSettingRow
): MemoItemLockSettingRecord {
  return {
    memoId: row.memo_id,
    userId: row.user_id,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toMemoLockSession(row: MemoLockSessionRow, rawToken: string): MemoLockSession {
  return {
    id: row.id,
    rawToken,
    expiresAt: row.expires_at
  };
}

export function createMemoLockRepository(db: D1Database): MemoLockRepository {
  async function getSetting(userId: string) {
    const row = await db
      .prepare(
        `SELECT
          user_id,
          password_hash,
          salt,
          created_at,
          updated_at
        FROM memo_lock_settings
        WHERE user_id = ?`
      )
      .bind(userId)
      .first<MemoLockSettingRow>();

    return row ? toMemoLockSettingRecord(row) : null;
  }

  async function getMemoSetting(userId: string, memoId: string) {
    const row = await db
      .prepare(
        `SELECT
          memo_id,
          user_id,
          password_hash,
          salt,
          created_at,
          updated_at
        FROM memo_item_lock_settings
        WHERE user_id = ? AND memo_id = ?`
      )
      .bind(userId, memoId)
      .first<MemoItemLockSettingRow>();

    return row ? toMemoItemLockSettingRecord(row) : null;
  }

  async function revokeUnlockSession(userId: string, sessionId: string) {
    const result = await db
      .prepare("DELETE FROM memo_lock_sessions WHERE user_id = ? AND id = ?")
      .bind(userId, sessionId)
      .run();

    return (result.meta.changes ?? 0) > 0;
  }

  async function revokeMemoUnlockSession(
    userId: string,
    memoId: string,
    sessionId: string
  ) {
    const result = await db
      .prepare(
        "DELETE FROM memo_item_lock_sessions WHERE user_id = ? AND memo_id = ? AND id = ?"
      )
      .bind(userId, memoId, sessionId)
      .run();

    return (result.meta.changes ?? 0) > 0;
  }

  return {
    async getStatus(userId) {
      const setting = await getSetting(userId);
      return {
        isConfigured: setting !== null
      };
    },
    async setupPassword(userId, password) {
      const existingSetting = await getSetting(userId);
      if (existingSetting) {
        return null;
      }

      const { passwordHash, salt } = await hashMemoLockPassword(password);
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO memo_lock_settings (
            user_id,
            password_hash,
            salt,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(userId, passwordHash, salt, now, now)
        .run();

      const setting = await getSetting(userId);
      if (!setting) {
        throw new Error("memo_lock_setup_failed");
      }

      return setting;
    },
    async verifyPassword(userId, password) {
      const setting = await getSetting(userId);
      if (!setting) {
        return false;
      }

      return verifyMemoLockPassword(password, setting.passwordHash, setting.salt);
    },
    async createUnlockSession(userId, ttlMs) {
      const sessionId = crypto.randomUUID();
      const rawToken = createRandomBase64Url(MEMO_LOCK_TOKEN_BYTES);
      const tokenHash = await hashMemoLockToken(rawToken);
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      await db
        .prepare(
          `INSERT INTO memo_lock_sessions (
            id,
            user_id,
            token_hash,
            expires_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(sessionId, userId, tokenHash, expiresAt, createdAt)
        .run();

      return toMemoLockSession(
        {
          id: sessionId,
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: createdAt
        },
        rawToken
      );
    },
    async verifyUnlockSession(userId, sessionId, rawToken) {
      const tokenHash = await hashMemoLockToken(rawToken);
      const row = await db
        .prepare(
          `SELECT
            id,
            user_id,
            token_hash,
            expires_at,
            created_at
          FROM memo_lock_sessions
          WHERE user_id = ? AND id = ? AND token_hash = ?`
        )
        .bind(userId, sessionId, tokenHash)
        .first<MemoLockSessionRow>();

      if (!row) {
        return false;
      }

      if (row.expires_at <= new Date().toISOString()) {
        await revokeUnlockSession(userId, sessionId);
        return false;
      }

      return true;
    },
    revokeUnlockSession,
    async revokeExpiredSessions(userId) {
      await db
        .prepare("DELETE FROM memo_lock_sessions WHERE user_id = ? AND expires_at <= ?")
        .bind(userId, new Date().toISOString())
        .run();
    },
    async getMemoStatus(userId, memoId) {
      const setting = await getMemoSetting(userId, memoId);
      return {
        isConfigured: setting !== null
      };
    },
    async setMemoPassword(userId, memoId, password) {
      const { passwordHash, salt } = await hashMemoLockPassword(password);
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO memo_item_lock_settings (
            memo_id,
            user_id,
            password_hash,
            salt,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(memo_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            salt = excluded.salt,
            updated_at = excluded.updated_at`
        )
        .bind(memoId, userId, passwordHash, salt, now, now)
        .run();

    },
    async deleteMemoPassword(userId, memoId) {
      await db
        .prepare("DELETE FROM memo_item_lock_sessions WHERE user_id = ? AND memo_id = ?")
        .bind(userId, memoId)
        .run();
      const result = await db
        .prepare("DELETE FROM memo_item_lock_settings WHERE user_id = ? AND memo_id = ?")
        .bind(userId, memoId)
        .run();

      return (result.meta.changes ?? 0) > 0;
    },
    async verifyMemoPassword(userId, memoId, password) {
      const setting = await getMemoSetting(userId, memoId);
      if (!setting) {
        return false;
      }

      return verifyMemoLockPassword(password, setting.passwordHash, setting.salt);
    },
    async createMemoUnlockSession(userId, memoId, ttlMs) {
      const sessionId = crypto.randomUUID();
      const rawToken = createRandomBase64Url(MEMO_LOCK_TOKEN_BYTES);
      const tokenHash = await hashMemoLockToken(rawToken);
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      await db
        .prepare(
          `INSERT INTO memo_item_lock_sessions (
            id,
            memo_id,
            user_id,
            token_hash,
            expires_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(sessionId, memoId, userId, tokenHash, expiresAt, createdAt)
        .run();

      return {
        id: sessionId,
        rawToken,
        expiresAt
      };
    },
    async verifyMemoUnlockSession(userId, memoId, sessionId, rawToken) {
      const tokenHash = await hashMemoLockToken(rawToken);
      const row = await db
        .prepare(
          `SELECT
            id,
            memo_id,
            user_id,
            token_hash,
            expires_at,
            created_at
          FROM memo_item_lock_sessions
          WHERE user_id = ? AND memo_id = ? AND id = ? AND token_hash = ?`
        )
        .bind(userId, memoId, sessionId, tokenHash)
        .first<MemoItemLockSessionRow>();

      if (!row) {
        return false;
      }

      if (row.expires_at <= new Date().toISOString()) {
        await revokeMemoUnlockSession(userId, memoId, sessionId);
        return false;
      }

      return true;
    },
    revokeMemoUnlockSession,
    async revokeMemoUnlockSessions(userId, memoId) {
      await db
        .prepare("DELETE FROM memo_item_lock_sessions WHERE user_id = ? AND memo_id = ?")
        .bind(userId, memoId)
        .run();
    },
    async revokeExpiredMemoSessions(userId) {
      await db
        .prepare(
          "DELETE FROM memo_item_lock_sessions WHERE user_id = ? AND expires_at <= ?"
        )
        .bind(userId, new Date().toISOString())
        .run();
    }
  };
}
