CREATE TABLE memo_item_lock_settings (
  memo_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE memo_item_lock_sessions (
  id TEXT PRIMARY KEY,
  memo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_memo_item_lock_settings_user
ON memo_item_lock_settings(user_id);

CREATE INDEX idx_memo_item_lock_sessions_memo_user_expires
ON memo_item_lock_sessions(memo_id, user_id, expires_at);

INSERT INTO memo_item_lock_settings (
  memo_id,
  user_id,
  password_hash,
  salt,
  created_at,
  updated_at
)
SELECT
  memos.id,
  memos.user_id,
  memo_lock_settings.password_hash,
  memo_lock_settings.salt,
  memo_lock_settings.created_at,
  memo_lock_settings.updated_at
FROM memos
INNER JOIN memo_lock_settings
  ON memo_lock_settings.user_id = memos.user_id
WHERE memos.is_locked = 1;
