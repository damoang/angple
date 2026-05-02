-- #1224 멀티사이트 도메인→테마/SEO 매핑 DB 이전
-- ConfigSiteResolver(JSON) 다음 순위로 동작하는 DbSiteResolver 의 데이터 소스.
-- payment 플러그인의 site_id 도 이 테이블의 id 를 참조 (numeric).

CREATE TABLE IF NOT EXISTS angple_sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    theme_id VARCHAR(100) NOT NULL,
    site_title VARCHAR(255) DEFAULT NULL,
    site_description TEXT DEFAULT NULL,
    site_url VARCHAR(500) DEFAULT NULL,
    logo_url VARCHAR(500) DEFAULT NULL,
    favicon_url VARCHAR(500) DEFAULT NULL,
    keywords JSON DEFAULT NULL,
    settings JSON DEFAULT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_domain (domain),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 도메인 alias 지원 (config 의 aliases[] 와 동일한 역할)
CREATE TABLE IF NOT EXISTS angple_site_aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    domain VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_alias_domain (domain),
    INDEX idx_site (site_id),
    CONSTRAINT fk_alias_site FOREIGN KEY (site_id) REFERENCES angple_sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
