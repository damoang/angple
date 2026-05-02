CREATE TABLE IF NOT EXISTS brickang_position_locks (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id     INT UNSIGNED NOT NULL,
    position_x      INT NOT NULL,
    position_y      INT NOT NULL,
    position_z      INT NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    expires_at      DATETIME(6) NOT NULL,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_position_lock (building_id, position_x, position_y, position_z),
    KEY ix_user (user_id),
    KEY ix_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
