-- 002_clear_stale_mb_leave_date.sql
--
-- Purpose: 탈퇴(mb_leave_date) 표시가 남아있으나 이미 다시 로그인하여
--          활동 중인 회원의 mb_leave_date 를 빈 문자열로 복구.
--          (#9395 참조 — 프로필에 '탈퇴'로 표시되지만 댓글/접속 기록이 있음)
--
-- Safety:
--   - mb_today_login 이 STR_TO_DATE(mb_leave_date, '%Y%m%d') 보다 이후인 경우만 대상
--     → 탈퇴 후 실제 재로그인이 발생한 계정만 클리어
--   - mb_intercept_date 는 건드리지 않음 (어드민 정지는 별도 필드)
--   - mb_leave_date 가 '0000-00-00' 이거나 null 인 경우는 제외
--
-- Rollback 참고:
--   별도 백업 테이블에 현재 상태 스냅샷을 먼저 남기기 권장:
--     CREATE TABLE g5_member_leave_backup_20260419 AS
--     SELECT mb_id, mb_leave_date, mb_today_login
--     FROM g5_member
--     WHERE mb_leave_date != '' AND mb_leave_date != '0000-00-00';
--
-- Verify (DRY RUN):
--   SELECT COUNT(*) AS affected
--   FROM g5_member
--   WHERE mb_leave_date != ''
--     AND mb_leave_date != '0000-00-00'
--     AND mb_today_login IS NOT NULL
--     AND mb_today_login > STR_TO_DATE(mb_leave_date, '%Y%m%d');
--
-- Apply:
UPDATE g5_member
SET mb_leave_date = ''
WHERE mb_leave_date != ''
  AND mb_leave_date != '0000-00-00'
  AND mb_today_login IS NOT NULL
  AND mb_today_login > STR_TO_DATE(mb_leave_date, '%Y%m%d');
