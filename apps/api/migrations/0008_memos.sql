CREATE TABLE memo_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_folder_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_folder_id) REFERENCES memo_folders(id)
);

CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_text TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  memo_color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (folder_id) REFERENCES memo_folders(id)
);

CREATE TABLE memo_tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE memo_tag_links (
  memo_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (memo_id, tag_id),
  FOREIGN KEY (memo_id) REFERENCES memos(id),
  FOREIGN KEY (tag_id) REFERENCES memo_tags(id)
);

CREATE TABLE memo_assets (
  id TEXT PRIMARY KEY,
  memo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  thumbnail_object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_memo_folders_user_id ON memo_folders(user_id);
CREATE INDEX idx_memo_folders_parent ON memo_folders(user_id, parent_folder_id, sort_order);
CREATE INDEX idx_memos_user_updated_at ON memos(user_id, updated_at DESC);
CREATE INDEX idx_memos_user_folder_updated_at ON memos(user_id, folder_id, updated_at DESC);
CREATE INDEX idx_memos_user_favorite_updated_at ON memos(user_id, is_favorite, updated_at DESC);
CREATE INDEX idx_memo_tags_user_id ON memo_tags(user_id);
CREATE INDEX idx_memo_tag_links_tag_memo ON memo_tag_links(tag_id, memo_id);
CREATE INDEX idx_memo_assets_user_memo_sort ON memo_assets(user_id, memo_id, sort_order, created_at);
