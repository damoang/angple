-- 005_member_restore_trigger.sql — mb_leave_date 가 비워지는 모든 경로를 한 자리에서 기록한다.
-- 설계: docs/2026-09-22-voluntary-leaver-return-sprint.html §8-2 (D7)
--
-- 왜: 2026-09-23 조사에서 세 주체(캐시창 재로그인·F3 재활성·운영자 수작업 SQL)가 같은 컬럼을
--     기록 없이 비웠고, CF(회원 미식별)·ALB(CloudFront IP 만)·파드로그(4h) 어디서도 사후 재구성이
--     불가능했다. 비우는 순간 DB 가 직접 남기는 것이 유일한 방법이다.
--
-- 원칙:
--   ① fail-open — 트리거 안의 어떤 오류도 원본 UPDATE 를 막지 않는다 (CONTINUE HANDLER + INSERT IGNORE).
--   ② 주체 — 세션변수 @damoang_actor 가 유일한 식별 수단이다. 라이브는 web/backend/ops 가 모두 같은
--      DB 계정·같은 호스트로 접속하므로 계정으로는 구분이 안 되고, 트리거 안의 CURRENT_USER() 는
--      접속 계정이 아니라 DEFINER 를 돌려준다(저장 프로그램 규칙). USER() 로 접속 계정@호스트만 남기고,
--      코드·운영 SQL 은 **같은 커넥션에서** `SET @damoang_actor='ops:<이름>:<사유>'; UPDATE …; SET @damoang_actor=NULL;`
--      순서로 실행해야 reason 에 주체가 병기된다(풀 커넥션에서 세션변수가 다음 쿼리로 새는 것을 막기 위해 초기화 필수).
--   ④ 핸들러가 못 잡는 것 — 트리거 본문 밖 오류: DEFINER 계정 삭제·권한 회수 시 1449(원본 UPDATE 실패),
--      데드락 1213(InnoDB 가 트랜잭션 전체 롤백), leave_history DDL 중 메타데이터 락 대기. 낮은 확률이나 기재해 둔다.
--   ③ 코드 경로가 이미 restore 를 직접 기록하는 경우 중복될 수 있다 — UNIQUE (mb_id,event,event_at) 가
--      같은 초 안의 중복을 IGNORE 로 흡수한다. 다른 초면 2행 남는데 그건 「두 번 기록」이지 손실이 아니다.
--
-- ⛔ k3s 는 마이그레이션을 자동 실행하지 않는다 → 라이브 DB 수동 적용.
-- ⛔ 카나리 DB = 운영 DB 공유 → 적용 즉시 운영. 사장님 컨펌 + Harness(별도 Evaluator, 라이브 검증) 후 적용.
-- 실증: SHOW TRIGGERS LIKE 'g5_member';  → trg_member_leave_restore
-- 라이브 검증(테스트 계정 1건): UPDATE g5_member SET mb_leave_date='' WHERE mb_id='<test>' → leave_history 에 restore 1행.

DROP TRIGGER IF EXISTS trg_member_leave_restore;

DELIMITER $$
CREATE TRIGGER trg_member_leave_restore
AFTER UPDATE ON g5_member
FOR EACH ROW
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;  -- ① 어떤 실패도 UPDATE 를 막지 않음
  IF OLD.mb_leave_date <> '' AND NEW.mb_leave_date = '' THEN
    INSERT IGNORE INTO g5_da_member_leave_history
      (mb_id, event, event_at, leave_date, intercept_date, was_disciplined, mb_level, reason, source, created_at)
    VALUES
      (NEW.mb_id, 'restore', NOW(), OLD.mb_leave_date, IFNULL(NEW.mb_intercept_date,''),
       IF(IFNULL(OLD.mb_intercept_date,'')<>'',1,0), IFNULL(NEW.mb_level,0),
       LEFT(CONCAT('trigger by ', USER(),
                   IF(@damoang_actor IS NULL OR @damoang_actor='', '', CONCAT(' / ', @damoang_actor)),
                   IF(IFNULL(OLD.mb_leave_reason,'')<>'', CONCAT(' / prev_reason=', OLD.mb_leave_reason), '')), 255),
       'trigger', NOW());
  END IF;
END$$
DELIMITER ;
