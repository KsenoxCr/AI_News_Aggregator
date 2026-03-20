SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS
  digest_sources,
  magic_link_tokens,
  news_digests,
  sessions,
  user_categories,
  user_preferences,
  users;

SET FOREIGN_KEY_CHECKS = 1;
