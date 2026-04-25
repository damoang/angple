export interface SiteContext {
    id: string;
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
