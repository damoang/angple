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
    source: 'config' | 'manifest' | 'db' | 'env';
}

export interface SiteResolver {
    resolve(host: string): Promise<SiteContext | null>;
}
