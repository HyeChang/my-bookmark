ALTER TABLE memo_folders
ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_memo_folders_user_hidden
ON memo_folders(user_id, is_hidden);
