-- #1599 멀티사이트 footer/business 정보 DB 이전
-- footer 의 사업자/법무 정보(상호·대표·사업자등록번호·통신판매업신고·주소·연락처·저작권)를
-- 코어 하드코딩에서 angple_sites 사이트별 설정으로 이전.
--
-- 미설정(NULL) 사이트는 footer 의 사업자 블록을 미렌더 → 사업자 등록 전 신규 사이트가
-- 다른 회사 정보를 노출하지 않음 (opt-in). DbSiteResolver(SELECT *)가 자동 포함.
--
-- JSON 구조(예):
-- {
--   "company": "주식회사 OOO", "ceo": "홍길동",
--   "business_no": "123-45-67890", "ecommerce_no": "2026-..-0001",
--   "address": "...", "email": "info@example.com", "report_email": "...",
--   "copyright": "© 2026 OOO", "copyright_url": "https://...",
--   "powered_by": true
-- }

ALTER TABLE angple_sites
    ADD COLUMN business JSON DEFAULT NULL
    COMMENT 'site-specific footer/business info (company, ceo, business_no, address, copyright...)';
