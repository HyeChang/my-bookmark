CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created_at
ON bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_folder_created_at
ON bookmarks(user_id, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_favorite_created_at
ON bookmarks(user_id, is_favorite, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_bookmark
ON bookmark_tags(tag_id, bookmark_id);

CREATE INDEX IF NOT EXISTS idx_assets_user_bookmark_sort
ON bookmark_assets(user_id, bookmark_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_activity_user_event_occurred
ON bookmark_activity(user_id, event_type, occurred_at DESC);
