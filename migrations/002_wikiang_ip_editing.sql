-- 위키앙(Wikiang) 마이그레이션
-- Phase 1 / 증분 1: IP 기반 익명편집 코어
--
-- 목적:
--   - 익명(비로그인) 편집을 허용하되, 작성 IP를 서버에만 보존(차단·수사용)하고
--     표시는 해시 라벨로만 노출한다.
--   - IP 범위 차단(밴) 조회를 위한 테이블을 만든다.
--
-- 주의:
--   - 이 파일은 검토용이다. 자동 적용하지 말 것(사람이 검토 후 수동 적용).
--   - additive(기존 데이터 보존): author_id 는 그대로 두고(NULL=익명, 값=레거시 회원),
--     author_ip / author_ip_hash 컬럼만 추가한다.
--   - MySQL 8.0 은 `ADD COLUMN IF NOT EXISTS` 를 지원하지 않는다.
--     적용 전 아래로 컬럼 부재를 확인하고, 이미 있으면 해당 ALTER 는 건너뛴다.
--       SHOW CREATE TABLE wikiang_revisions;  -- author_ip / author_ip_hash 없는지 확인
--   - 라이브 확인 완료(2026-09-01): wikiang_revisions 에 두 컬럼 모두 없음(충돌 없음).

-- 1) 리비전 테이블에 작성자 IP 컬럼 추가
--    author_ip      : 원본 IP(INET6_ATON 결과, VARBINARY(16)). 서버 차단/수사 전용, 절대 응답으로 내보내지 않음.
--    author_ip_hash : 표시용 안정 해시(같은 IP=같은 해시). 익명 작성자 라벨에만 사용.
ALTER TABLE wikiang_revisions
    ADD COLUMN author_ip VARBINARY(16) NULL COMMENT '원본 IP(INET6_ATON). 서버 전용, 노출 금지',
    ADD COLUMN author_ip_hash VARCHAR(64) NULL COMMENT '표시용 IP 해시(익명 라벨)';

-- 2) IP 범위 차단(밴) 테이블
--    범위는 INET6_ATON 바이너리(ip_start ~ ip_end)로 저장하며,
--    저장 경로에서 INET6_ATON(작성IP) BETWEEN ip_start AND ip_end 로 매칭한다.
CREATE TABLE IF NOT EXISTS wikiang_ip_blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_start VARBINARY(16) NOT NULL COMMENT '차단 범위 시작(INET6_ATON)',
    ip_end VARBINARY(16) NOT NULL COMMENT '차단 범위 끝(INET6_ATON)',
    reason VARCHAR(255) DEFAULT '' COMMENT '차단 사유',
    created_by VARCHAR(64) DEFAULT '' COMMENT '등록자',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL COMMENT 'NULL=무기한',
    KEY idx_range (ip_start, ip_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
