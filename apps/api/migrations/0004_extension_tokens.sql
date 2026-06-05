CREATE TABLE extension_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX extension_tokens_user_id_idx
  ON extension_tokens(user_id, revoked_at, created_at);
