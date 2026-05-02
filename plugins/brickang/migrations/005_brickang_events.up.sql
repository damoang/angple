CREATE TABLE IF NOT EXISTS brickang_events (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id         INT UNSIGNED NOT NULL,
    event_type          ENUM('milestone','season_start','season_end','special') NOT NULL,
    milestone_count     INT UNSIGNED NULL,
    title               VARCHAR(200),
    description         TEXT,
    reward_description  TEXT,
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY ix_building (building_id),
    KEY ix_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
