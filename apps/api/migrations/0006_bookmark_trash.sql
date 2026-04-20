ALTER TABLE bookmarks
ADD COLUMN trashed_at TEXT;

CREATE INDEX idx_bookmarks_user_trashed_at
ON bookmarks(user_id, trashed_at);
