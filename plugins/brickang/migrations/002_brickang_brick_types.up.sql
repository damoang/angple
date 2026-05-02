CREATE TABLE IF NOT EXISTS brickang_brick_types (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(50) NOT NULL,
    price_krw       INT UNSIGNED NOT NULL DEFAULT 1000,
    price_usd       DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    color_hex       VARCHAR(7) NOT NULL DEFAULT '#C84C32',
    texture_url     VARCHAR(500) NULL,
    size_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    glow_effect     TINYINT(1) NOT NULL DEFAULT 0,
    is_anonymous    TINYINT(1) NOT NULL DEFAULT 0,
    allow_message   TINYINT(1) NOT NULL DEFAULT 1,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO brickang_brick_types
    (slug, name, price_krw, price_usd, color_hex, size_multiplier, glow_effect, is_anonymous, allow_message, sort_order)
VALUES
    ('anonymous', '익명 벽돌',     100,  0.10, '#A0A0A0', 1.00, 0, 1, 0, 0),
    ('normal',    '일반 벽돌',    1000,  1.00, '#C84C32', 1.00, 0, 0, 1, 1),
    ('silver',    '은 벽돌',      3000,  3.00, '#C0C0C0', 1.00, 0, 0, 1, 2),
    ('gold',      '금 벽돌',      5000,  5.00, '#FFD700', 1.00, 1, 0, 1, 3),
    ('diamond',   '다이아 벽돌', 10000, 10.00, '#B9F2FF', 1.50, 1, 0, 1, 4)
