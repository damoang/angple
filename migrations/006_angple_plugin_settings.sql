-- 플러그인 활성상태 SoT(Source of Truth) 를 MySQL 로 이관 (Option C 1단계)
-- 기존 파일 기반(data/plugin-settings.json)은 다중 파드에서 성립하지 않는다:
--   prod web 파드 다수에 볼륨 마운트가 없어 파일이 이미지에 구워진 채 파드별로 분리된다
--   → admin 토글이 파드 1개에만 적용되고 재배포 시 소실된다.
--
-- 테마 설정(angple_settings, LONGTEXT key-value)과 달리 플러그인은 **플러그인당 1행**으로
-- 저장한다. 그래야 활성/비활성이 원자적 UPSERT(INSERT ... ON DUPLICATE KEY UPDATE) 로 처리되어
-- read-modify-write 경쟁(빈 목록에 하나만 얹어 나머지가 전부 꺼지는 사고)이 원천 차단된다.
--
-- ⛔ prod 는 AutoMigrate 가 돌지 않는다 — 이 DDL 을 배포 전에 수동 선행 적용할 것.
--    (배포 순서: 006 DDL → 007 백필 → env PLUGIN_SETTINGS_PROVIDER=mysql → 롤링 재배포)

CREATE TABLE IF NOT EXISTS angple_plugin_settings (
    plugin_id VARCHAR(100) PRIMARY KEY,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    settings JSON NULL,
    activated_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
