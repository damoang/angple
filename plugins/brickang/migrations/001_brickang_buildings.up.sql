CREATE TABLE IF NOT EXISTS brickang_buildings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    target_bricks   INT UNSIGNED NOT NULL,
    current_bricks  INT UNSIGNED NOT NULL DEFAULT 0,
    status          ENUM('active','completed','archived') NOT NULL DEFAULT 'active',
    blueprint_data  JSON,
    dimension_x     INT UNSIGNED NOT NULL DEFAULT 20,
    dimension_y     INT UNSIGNED NOT NULL DEFAULT 30,
    dimension_z     INT UNSIGNED NOT NULL DEFAULT 20,
    season          INT UNSIGNED NOT NULL DEFAULT 1,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completed_at    DATETIME(6) NULL,
    INDEX idx_status (status),
    INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
