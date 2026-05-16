-- ad-free 플러그인: 사용자 광고 제거 멤버십 상태
-- (mb_id, site_id) 복합 PK — 멀티사이트 (#1287) 대비.
-- payment_order_id 는 payment_orders.id 참조이나, 플러그인 의존성 가정상
-- FK 제약은 두지 않음 (payment 플러그인 비활성화 시에도 행 유지).

CREATE TABLE IF NOT EXISTS ad_free_membership (
    mb_id              VARCHAR(20)  NOT NULL,
    site_id            VARCHAR(64)  NOT NULL DEFAULT 'default',
    plan               ENUM('monthly', 'yearly') NOT NULL,
    status             ENUM('trialing', 'active', 'past_due', 'canceled', 'expired') NOT NULL DEFAULT 'trialing',
    current_period_end DATETIME     NULL,
    trial_end          DATETIME     NULL,
    payment_provider   ENUM('naverpay', 'paypal', 'toss', 'manual') NULL,
    payment_order_id   VARCHAR(64)  NULL COMMENT 'payment_orders.id 참조 (느슨한 결합)',
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (mb_id, site_id),
    INDEX idx_status_period (status, current_period_end),
    INDEX idx_site_id (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='광고 제거 멤버십 (ad-free 플러그인)';
