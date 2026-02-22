-- Angple 인증 시스템 마이그레이션
-- Phase 1: Refresh Token 로테이션 + 폐기
-- Phase 2: 서버사이드 세션

-- 1. Refresh Token 폐기 테이블 (Phase 1)
CREATE TABLE IF NOT EXISTS angple_refresh_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 해시',
    mb_id VARCHAR(20) NOT NULL,
    family_id VARCHAR(64) NOT NULL COMMENT '토큰 패밀리 (로테이션 추적)',
    ip VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME DEFAULT NULL,
    INDEX idx_token_hash (token_hash),
    INDEX idx_mb_id (mb_id),
    INDEX idx_family_id (family_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 서버사이드 세션 테이블 (Phase 2)
CREATE TABLE IF NOT EXISTS angple_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 해시',
    mb_id VARCHAR(20) NOT NULL,
    csrf_token VARCHAR(64) NOT NULL,
    ip VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(512) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    UNIQUE KEY uk_session_hash (session_id_hash),
    INDEX idx_mb_id (mb_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 만료된 토큰/세션 정리 이벤트 (선택사항)
-- MySQL Event Scheduler 활성화 필요: SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS cleanup_expired_tokens
--     ON SCHEDULE EVERY 1 HOUR
--     DO DELETE FROM angple_refresh_tokens WHERE expires_at < NOW();
-- CREATE EVENT IF NOT EXISTS cleanup_expired_sessions
--     ON SCHEDULE EVERY 1 HOUR
--     DO DELETE FROM angple_sessions WHERE expires_at < NOW();
