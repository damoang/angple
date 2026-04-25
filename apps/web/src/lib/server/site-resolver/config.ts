import { promises as fs } from 'node:fs';
import type { SiteContext, SiteResolver } from './index.js';

interface SiteOverrideEntry {
    schema_version?: number;
    domain: string;
    aliases?: string[];
    theme_id: string;
    title?: string;
    description?: string;
    keywords?: string[];
    logo_url?: string;
    favicon_url?: string;
}

interface SiteOverridesFile {
    schema_version: number;
    overrides: SiteOverrideEntry[];
}

export class ConfigSiteResolver implements SiteResolver {
    private map: Map<string, SiteContext> = new Map();
    private loaded = false;

    constructor(private readonly path: string) {}

    async load(): Promise<void> {
        if (this.loaded) return;
        try {
            const raw = await fs.readFile(this.path, 'utf-8');
            const data = JSON.parse(raw) as SiteOverridesFile;
            if (data.schema_version !== 1) {
                console.warn(
                    `[site-resolver] schema_version mismatch in ${this.path}: expected 1, got ${data.schema_version}`
                );
            }
            for (const entry of data.overrides ?? []) {
                const ctx: SiteContext = {
                    id: `config:${entry.domain}`,
                    theme_id: entry.theme_id,
                    title: entry.title,
                    description: entry.description,
                    keywords: entry.keywords,
                    logo_url: entry.logo_url,
                    favicon_url: entry.favicon_url,
                    source: 'config'
                };
                const keys = [entry.domain, ...(entry.aliases ?? [])];
                for (const key of keys) {
                    const lower = key.toLowerCase();
                    if (this.map.has(lower)) {
                        console.error(`[site-resolver] duplicate domain in ${this.path}: ${lower}`);
                        continue;
                    }
                    this.map.set(lower, ctx);
                }
            }
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') {
                // Config file optional — open-core users may not have one.
                console.info(`[site-resolver] no config at ${this.path}, skipping`);
            } else {
                console.error(`[site-resolver] failed to load ${this.path}:`, err);
            }
        }
        this.loaded = true;
    }

    async resolve(host: string): Promise<SiteContext | null> {
        if (!this.loaded) await this.load();
        return this.map.get(host.toLowerCase()) ?? null;
    }
}
