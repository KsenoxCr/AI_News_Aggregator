CREATE TABLE users (
    id              VARCHAR(36)  PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    image           VARCHAR(2048),
    role            VARCHAR(5)   NOT NULL DEFAULT 'user',
    preferences     TEXT,
    locale          VARCHAR(10)  NOT NULL DEFAULT 'en',
    news_language   VARCHAR(10)  NOT NULL DEFAULT 'en',
    selected_agent  VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE sessions (
    id              VARCHAR(36)  PRIMARY KEY,
    user_id         VARCHAR(36)  NOT NULL,
    token           VARCHAR(255) NOT NULL UNIQUE,
    session_type    VARCHAR(5)   NOT NULL DEFAULT 'user',
    expires_at      TIMESTAMP    NOT NULL,
    last_active_at  TIMESTAMP    NOT NULL,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE magic_link_tokens (
    id          VARCHAR(36)   PRIMARY KEY,
    token_hash  VARCHAR(64)   NOT NULL UNIQUE,
    value       VARCHAR(255)  NOT NULL,
    used        BOOLEAN       DEFAULT FALSE,
    used_at     TIMESTAMP     DEFAULT NULL,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP      NOT NULL,
    updated_at  TIMESTAMP      NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE agents (
    id      VARCHAR(36) NOT NULL PRIMARY KEY,
    slug    VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    api_key VARCHAR(256) NOT NULL,
    model   VARCHAR(256) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    user_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (user_id, slug),
    UNIQUE KEY (user_id, provider),
    INDEX idx_users_agents (user_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE sources (
  id  VARCHAR(36) NOT NULL PRIMARY KEY,
  slug  VARCHAR(30) NOT NULL,
  url  VARCHAR(100) NOT NULL,
  enabled           BOOLEAN DEFAULT TRUE,
  auth_type         ENUM('none', 'basic', 'bearer', 'api_key', 'cookie') NOT NULL DEFAULT 'none',
  auth_credential   TEXT DEFAULT NULL,
  date_filter_param VARCHAR(255) DEFAULT NULL,
  date_format       ENUM('ISO_8601', 'ISO_DATE', 'UNIX', 'RFC_1123', 'RFC_822') DEFAULT NULL,
  is_metered        BOOLEAN NOT NULL DEFAULT FALSE,
  previous_etag     VARCHAR(255) DEFAULT NULL,
  user_id           VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY (user_id, slug),
  UNIQUE KEY (user_id, url)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE cached_articles (
    id            VARCHAR(36)  PRIMARY KEY,
    source_id     VARCHAR(36)  NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL,
    link          VARCHAR(2048) NOT NULL,
    author        VARCHAR(255)  NOT NULL,
    published_at  TIMESTAMP     NOT NULL,
    used          BOOLEAN       NOT NULL DEFAULT FALSE,
    INDEX idx_published_at (published_at, used)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE news_digests ( -- TODO: rename to digest_aggregate
    id            VARCHAR(36)  PRIMARY KEY,
    user_id       VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at    TIMESTAMP    NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_summaries_user_date (user_id, updated_at),
    INDEX idx_summaries_expires (expires_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE digest_revisions (
    id            VARCHAR(36)  PRIMARY KEY,
    digest_id     VARCHAR(36)  NOT NULL,
    article_id    VARCHAR(36)  NOT NULL REFERENCES cached_articles(id) ON DELETE CASCADE,
    revision      INT UNSIGNED NOT NULL,
    agent_id      VARCHAR(36)  NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title         TEXT         NOT NULL,
    digest        LONGTEXT     NOT NULL,
    input_tokens  INT UNSIGNED NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (digest_id) REFERENCES news_digests(id) ON DELETE CASCADE,
    UNIQUE KEY uq_digest_revision (digest_id, revision),
    INDEX idx_digest_revisions_digest (digest_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE digest_sources (
    id          VARCHAR(36)   PRIMARY KEY,
    digest_id   VARCHAR(36)   NOT NULL REFERENCES news_digests(id) ON DELETE CASCADE,
    url         VARCHAR(2048) NOT NULL,
    url_hash    VARCHAR(64)   NOT NULL,  -- For indexing compliance with older InnoDB versions
    title       VARCHAR(500),
    source_id   VARCHAR(36) REFERENCES sources(id) ON DELETE CASCADE,
    published_at TIMESTAMP,
    INDEX idx_digest_sources (digest_id),
    INDEX idx_url_hash (url_hash)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE categories (
  slug VARCHAR(100) PRIMARY KEY
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE user_categories (
  user_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category  VARCHAR(100) NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE article_categories (
  article_id   VARCHAR(36) NOT NULL REFERENCES cached_articles(id) ON DELETE CASCADE,
  category  VARCHAR(100) NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  PRIMARY KEY (article_id, category)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE digest_categories (
  digest_id   VARCHAR(36) NOT NULL REFERENCES news_digests(id) ON DELETE CASCADE,
  category  VARCHAR(100) NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  PRIMARY KEY (digest_id, category)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
