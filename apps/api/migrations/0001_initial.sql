CREATE TABLE users (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE folders (
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
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id)
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  bookmark_color TEXT,
  url_color TEXT,
  source_title TEXT,
  source_content TEXT,
  source_summary TEXT,
  source_description TEXT,
  source_thumbnail_url TEXT,
  user_title TEXT,
  user_content TEXT,
  user_summary TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  summary_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (bookmark_id, tag_id),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE bookmark_assets (
  id TEXT PRIMARY KEY,
  bookmark_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE bookmark_activity (
  id TEXT PRIMARY KEY,
  bookmark_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE bookmark_extraction_logs (
  id TEXT PRIMARY KEY,
  bookmark_id TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  extractor_source TEXT,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id)
);

CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_folder_id ON bookmarks(folder_id);
CREATE INDEX idx_bookmarks_favorite ON bookmarks(user_id, is_favorite);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_assets_bookmark_id ON bookmark_assets(bookmark_id);
