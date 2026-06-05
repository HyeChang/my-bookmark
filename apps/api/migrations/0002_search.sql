CREATE VIRTUAL TABLE bookmark_search USING fts5(
  bookmark_id UNINDEXED,
  title,
  content,
  tags
);
