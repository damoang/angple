-- 006 으로 만든 angple_plugin_settings 에 현재 활성 플러그인 백필 (Option C 1단계)
--
-- ⛔ 정본(SoT)은 파일이 아니라 **운영 DB 의 angple_settings.active_plugins** 다.
--    운영 env 는 이미 PLUGIN_SETTINGS_PROVIDER=mysql 이고, 기존 MySqlPluginSettingsProvider 가
--    공유 테이블 angple_settings 의 setting_key='active_plugins' 행(JSON 배열)을 SoT 로 쓴다.
--    apps/web/data/plugin-settings.json(파일)은 stale 드리프트 상태다 — 백필에 쓰지 말 것.
--    (2026-08 실측: 파일 10개 vs 운영 SoT 13개. 파일 기준으로 백필하면
--     affiliate-link·angtt-review·poll 3개가 꺼진다.)
--
-- 방식: angple_settings.active_plugins(JSON 배열)를 JSON_TABLE 로 펼쳐 그대로 전용 테이블로 옮긴다.
--   하드코딩 목록이 아니라 운영 SoT 를 직접 읽으므로 향후 드리프트에도 안전하다.
--   참고 — 이 백필 시점의 운영 SoT(13개):
--     emoticon, bracket-image, auto-embed, member-memo, interaction-analysis, da-reaction,
--     affiliate-link-private, archive, payment, brickang, affiliate-link, angtt-review, poll
--
-- activated_at: 배열의 순서가 곧 활성 순서다. getActivePlugins() 가 `ORDER BY activated_at, plugin_id`
--   로 정렬하므로, 배열 인덱스(FOR ORDINALITY)만큼 NOW() 에 초를 더해 **원래 순서를 결정적으로 보존**한다.
--   (전부 NOW() 로 찍으면 알파벳순으로 재정렬되어 훅 실행 순서가 바뀔 수 있다.)
--
-- 멱등: ON DUPLICATE KEY UPDATE is_active=1 — 이미 있으면 활성만 보장하고 activated_at 은 안 건드린다.
--
-- 요구사항: MySQL 8.0+ (JSON_TABLE). angple_settings 컬럼은 setting_key / setting_value (LONGTEXT, JSON 텍스트).

INSERT INTO angple_plugin_settings (plugin_id, is_active, activated_at)
SELECT jt.pid, 1, NOW() + INTERVAL jt.rn SECOND
FROM angple_settings s,
     JSON_TABLE(
         s.setting_value,
         '$[*]' COLUMNS (
             rn  FOR ORDINALITY,
             pid VARCHAR(100) PATH '$'
         )
     ) AS jt
WHERE s.setting_key = 'active_plugins'
ON DUPLICATE KEY UPDATE is_active = 1;
