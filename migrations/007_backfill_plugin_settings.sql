-- 006 로 만든 angple_plugin_settings 에 현재 활성 플러그인 백필 (Option C 1단계)
-- 정본: apps/web/data/plugin-settings.json 의 activePlugins (2026-08 기준 10개).
--
-- activated_at 은 JSON 의 실제 activatedAt 값을 그대로 넣는다(NOW() 아님).
--   getActivePlugins() 가 `ORDER BY activated_at, plugin_id` 로 정렬하므로, 전부 NOW() 로
--   찍으면 알파벳 순으로 재정렬되어 훅 실행 순서가 바뀔 수 있다. 원래 활성 순서를 보존한다.
--
-- 멱등: ON DUPLICATE KEY UPDATE is_active=1 — 이미 있으면 활성만 보장하고 설정/시각은 건드리지 않는다.

INSERT INTO angple_plugin_settings (plugin_id, is_active, activated_at) VALUES
    ('emoticon',               1, '2026-02-04 14:51:20'),
    ('bracket-image',          1, '2026-02-07 12:00:00'),
    ('auto-embed',             1, '2026-02-07 12:00:00'),
    ('member-memo',            1, '2026-02-07 12:00:00'),
    ('interaction-analysis',   1, '2026-02-09 12:00:00'),
    ('da-reaction',            1, '2026-02-09 15:00:00'),
    ('affiliate-link-private', 1, '2026-03-22 13:50:00'),
    ('archive',                1, '2026-05-24 00:00:00'),
    ('payment',                1, '2026-06-09 00:00:00'),
    ('brickang',               1, '2026-06-09 00:00:00')
ON DUPLICATE KEY UPDATE is_active = 1;
