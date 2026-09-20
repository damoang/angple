-- 실명인증 시도 로그 (append-only · 영구보관)
-- 설계: docs/2026-09-19-cert-attempt-log-design.html
--
-- 배경: 인증 실패(중복충돌 등)는 console.log 에만 남아 파드 재시작과 함께 소실됐다.
--       성공만 g5_member_cert_history 에 남았다. 모든 시도를 기록해
--       「이미 가입된 내역」 충돌 시 어느 계정이 막았는지(existing_mb_id)를 추측 없이 확정한다.
-- 원칙: 개인정보(이름·생년·전화·CI) 미저장 — 개인정보처리방침(DI 만 보관)과 정합.
--       DELETE/UPDATE 경로 없음. 정리 크론 없음(DI 영구보관 결정, 2026-09-20).
-- ⛔ k3s 는 마이그레이션을 자동 실행하지 않는다. 라이브 DB 에 수동 적용 후 코드 배포.

CREATE TABLE IF NOT EXISTS g5_da_cert_attempt_log (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mb_id          VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '시도 계정 (세션만료 분기는 빈값 가능)',
  tx_id          VARCHAR(30)  NOT NULL DEFAULT '' COMMENT 'Inicis txId/mTxId (g5_cert_pending 과 동일 키)',
  result         VARCHAR(16)  NOT NULL COMMENT 'success|dup|provider_fail|invalid|decrypt_fail|no_session|id_mismatch|save_fail',
  provider       VARCHAR(12)  NOT NULL DEFAULT 'inicis',
  method         VARCHAR(12)  NOT NULL DEFAULT 'simple',
  dupinfo        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'DI. success/dup/no_session/id_mismatch/save_fail 에서만',
  existing_mb_id VARCHAR(20)  NOT NULL DEFAULT '' COMMENT 'dup 일 때 막은 계정',
  result_code    VARCHAR(8)   NOT NULL DEFAULT '' COMMENT '공급자 코드',
  result_msg     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '공급자 메시지 / 내부 사유',
  ip             VARCHAR(45)  NOT NULL DEFAULT '',
  user_agent     VARCHAR(255) NOT NULL DEFAULT '',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mb_time   (mb_id, created_at),
  KEY idx_existing  (existing_mb_id),
  KEY idx_dupinfo   (dupinfo),
  KEY idx_tx        (tx_id),
  KEY idx_result_at (result, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='실명인증 시도 로그 — append-only, 영구보관';
