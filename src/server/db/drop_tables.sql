SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS
  digest_sources,
  digest_revisions,
  magic_link_tokens,
  news_digests,
  digest_revisions,
  sessions,
  categories,
  digest_categories,
  user_categories,
  user_preferences,
  sources,
  agents,
  cached_articles,
  article_categories,
  fetches,
  users;

SET FOREIGN_KEY_CHECKS = 1;
