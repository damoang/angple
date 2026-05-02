CREATE TABLE IF NOT EXISTS brickang_user_stats (
    user_id         BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    total_bricks    INT UNSIGNED NOT NULL DEFAULT 0,
    total_spent_krw BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_spent_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
    first_brick_at  DATETIME(6) NULL,
    last_brick_at   DATETIME(6) NULL,
    user_rank       INT UNSIGNED NULL,
    updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY ix_rank (user_rank),
    KEY ix_total_bricks (total_bricks)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
