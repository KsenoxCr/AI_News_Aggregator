CREATE TABLE users (
    id          VARCHAR(36)  PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    is_admin    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id              VARCHAR(36)  PRIMARY KEY,
    user_id         VARCHAR(36)  NOT NULL,
    session_type            VARCHAR(5)   NOT NULL DEFAULT,
    expires_at      DATETIME     NOT NULL,
    last_active_at  DATETIME     NOT NULL,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE magic_link_tokens (
    id          VARCHAR(36)   PRIMARY KEY,
    token_hash  VARCHAR(64)   NOT NULL UNIQUE,
    email       VARCHAR(255)  NOT NULL,
    expires_at  DATETIME      NOT NULL,
    used        BOOLEAN       NOT NULL DEFAULT FALSE,
    used_at     DATETIME,
    ip_address  VARCHAR(45),
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_preferences (
    user_id     VARCHAR(36)  PRIMARY KEY,
    categories  JSON,
    sources     JSON,
    language    VARCHAR(10)  NOT NULL DEFAULT 'fi',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE news_digests (
    id            VARCHAR(36)  PRIMARY KEY,
    user_id       VARCHAR(36)  NOT NULL,
    category      VARCHAR(100),
    title         TEXT         NOT NULL,
    summary       TEXT,
    updated_at    DATETIME         NOT NULL,
    created_at    DATE     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    DATE     NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_summaries_user_date (user_id, updated_at),
    INDEX idx_summaries_expires (expires_at)
);

CREATE TABLE digest_sources (
    id          VARCHAR(36)   PRIMARY KEY,
    digest_id   VARCHAR(36)   NOT NULL,
    url         VARCHAR(2048) NOT NULL,
    url_hash    VARCHAR(64)   NOT NULL,  -- For indexing compliance with older InnoDB versions
    title       VARCHAR(500),
    source_name VARCHAR(100),
    published_at DATETIME,
    FOREIGN KEY (digest_id) REFERENCES news_digests(id) ON DELETE CASCADE,
    INDEX idx_digest_sources (digest_id),
    INDEX idx_url_hash (url_hash)
);
