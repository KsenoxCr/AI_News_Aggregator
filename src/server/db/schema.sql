CREATE TABLE users (
    id          VARCHAR(36)  PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    role        VARCHAR(5)   NOT NULL DEFAULT 'user',
    preferences TEXT,
    language    VARCHAR(10)  DEFAULT 'en',
    selected_agent VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE sessions (
    id              VARCHAR(36)  PRIMARY KEY,
    user_id         VARCHAR(36)  NOT NULL,
    session_type    VARCHAR(5)   NOT NULL DEFAULT 'user',
    expires_at      TIMESTAMP     NOT NULL,
    last_active_at  TIMESTAMP     NOT NULL,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE magic_link_tokens (
    id          VARCHAR(36)   PRIMARY KEY,
    token_hash  VARCHAR(64)   NOT NULL UNIQUE,
    email       VARCHAR(255)  NOT NULL,
    expires_at  TIMESTAMP      NOT NULL,
    used        BOOLEAN       NOT NULL DEFAULT FALSE,
    used_at     TIMESTAMP,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE agents (
    id      VARCHAR(36) NOT NULL PRIMARY KEY,
    slug    VARCHAR(30) NOT NULL,
    url     VARCHAR(100) NOT NULL,
    api_key VARCHAR(256) NOT NULL,
    user_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (user_id, slug),
    UNIQUE KEY (user_id, url)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE sources (
  id  VARCHAR(36) NOT NULL PRIMARY KEY,
  slug  VARCHAR(30) NOT NULL,
  url  VARCHAR(100) NOT NULL,
  user_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY (user_id, slug),
  UNIQUE KEY (user_id, url)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE categories (
  slug VARCHAR(100) PRIMARY KEY
);

CREATE TABLE user_categories (
  user_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category  VARCHAR(100) NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE news_digests (
    id            VARCHAR(36)  PRIMARY KEY,
    user_id       VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id      VARCHAR(36)  NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title         TEXT         NOT NULL,
    summary       TEXT,
    updated_at    TIMESTAMP         NOT NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP     NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_summaries_user_date (user_id, updated_at),
    INDEX idx_summaries_expires (expires_at)
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

CREATE TABLE digest_categories (
  digest_id   VARCHAR(36) NOT NULL REFERENCES news_digests(id) ON DELETE CASCADE,
  category  VARCHAR(100) NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  PRIMARY KEY (digest_id, category)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
