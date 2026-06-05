ALTER TABLE memos
ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_memos_user_locked
ON memos(user_id, is_locked);
