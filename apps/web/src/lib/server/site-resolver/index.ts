export interface SiteContext {
    id: string;
    /**
     * DB(angple_sites)에서 해석된 경우의 numeric primary key.
     * config/manifest/env resolver 는 이 필드를 채우지 않음 — 플러그인은 fallback 0 으로 처리.
     */
    numericId?: number;
    theme_id: string;
    title?: string;
    description?: string;
    keywords?: string[];
    logo_url?: string;
    favicon_url?: string;
    /**
     * 사이트별 footer/사업자 정보 (#1599). 미설정 시 undefined →
     * footer 의 사업자 블록을 렌더하지 않음 (신규/미등록 사이트가 타 회사 정보 노출 방지).
     */
    business?: SiteBusiness;
    source: 'config' | 'manifest' | 'db' | 'env';
}

export interface SiteBusiness {
    company?: string;
    ceo?: string;
    business_no?: string;
    ecommerce_no?: string;
    address?: string;
    email?: string;
    report_email?: string;
    copyright?: string;
    copyright_url?: string;
    /** angple.com "Powered by" 표기 여부 (기본 true). */
    powered_by?: boolean;
}

export interface SiteResolver {
    resolve(host: string): Promise<SiteContext | null>;
}
