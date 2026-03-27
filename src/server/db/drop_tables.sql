SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS
  digest_sources,
  magic_link_tokens,
  news_digests,
  sessions,
  categories,
  digest_categories,
  user_categories,
  user_preferences,
  sources,
  agents,
  cached_articles,
  users;

SET FOREIGN_KEY_CHECKS = 1;
