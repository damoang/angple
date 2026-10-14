-- Run against Wikiang's own database before enabling WIKIANG_GOOGLE_CLIENT_*.
-- Additive only: existing imported users and revision author IDs are preserved.
-- No email matching or automatic linking to an imported/community account.
CREATE TABLE IF NOT EXISTS wikiang_google_accounts (
    google_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (google_sub),
    UNIQUE KEY uq_wikiang_google_user (user_id),
    CONSTRAINT fk_wikiang_google_user FOREIGN KEY (user_id) REFERENCES wikiang_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
