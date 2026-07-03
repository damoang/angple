-- UI 개인화 설정 서버 저장 (#12891)
-- localStorage 전용 저장의 취약성(Safari ITP 7일 삭제 / 캐시삭제 / 기기 간 미동기)을
-- 보완하기 위해 로그인 회원의 UiSettings 전체 JSON을 회원당 1행으로 영구 저장한다.
-- MySQL = 진실 원본(durable), Redis(uis:{mb_id}) = 읽기 캐시.
-- 코드는 이 테이블이 없어도 graceful degrade(localStorage로 폴백)하므로,
-- 배포 후 아무 때나 적용해도 무방하다(적용 전에는 서버 저장이 비활성).

CREATE TABLE IF NOT EXISTS g5_da_member_ui_settings (
    mb_id      VARCHAR(20) NOT NULL,
    settings   JSON        NOT NULL COMMENT 'UiSettings 전체 blob(뮤트 키워드 포함)',
    updated_at DATETIME    NOT NULL,
    PRIMARY KEY (mb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
