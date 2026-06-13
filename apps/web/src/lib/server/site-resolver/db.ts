import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '$lib/server/db';
import { createCache, TieredCache } from '$lib/server/cache';
import type { SiteContext, SiteResolver } from './index.js';

interface SiteRow extends RowDataPacket {
    id: number;
    domain: string;
    theme_id: string;
    site_title: string | null;
    site_description: string | null;
    site_url: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    keywords: string | null;
    settings: string | null;
    business: string | null;
    active: number;
}

interface AliasRow extends RowDataPacket {
    site_id: number;
}

const cache = new TieredCache<SiteContext>('site:db', 60_000, 300, 200);
const missCache = createCache<true>({ ttl: 60_000, maxSize: 2000 });
const SCHEMA_RETRY_TTL_MS = 5 * 60_000;
let schemaUnavailableUntil = 0;

type ResolverDbError = Error & {
    code?: string;
    errno?: number | string;
};

function isMissingTableError(err: unknown): boolean {
    const dbErr = err as ResolverDbError;
    return dbErr?.code === 'ER_NO_SUCH_TABLE' || dbErr?.errno === 1146;
}

function rowToContext(row: SiteRow): SiteContext {
    let keywords: string[] | undefined;
    if (row.keywords) {
        try {
            const parsed = JSON.parse(row.keywords) as unknown;
            if (Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')) {
                keywords = parsed;
            }
        } catch {
            // ignore malformed JSON
        }
    }
    let business: SiteContext['business'];
    if (row.business) {
        try {
            const parsed = JSON.parse(row.business) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                business = parsed as SiteContext['business'];
            }
        } catch {
            // ignore malformed JSON
        }
    }
    return {
        id: `db:${row.id}`,
        numericId: row.id,
        theme_id: row.theme_id,
        title: row.site_title ?? undefined,
        description: row.site_description ?? undefined,
        keywords,
        logo_url: row.logo_url ?? undefined,
        favicon_url: row.favicon_url ?? undefined,
        business,
        source: 'db'
    };
}

async function lookupByHost(host: string): Promise<SiteContext | null> {
    const [rows] = await pool.query<SiteRow[]>(
        'SELECT * FROM angple_sites WHERE domain = ? AND active = 1 LIMIT 1',
        [host]
    );
    if (rows.length > 0) return rowToContext(rows[0]);

    const [aliasRows] = await pool.query<AliasRow[]>(
        'SELECT site_id FROM angple_site_aliases WHERE domain = ? LIMIT 1',
        [host]
    );
    if (aliasRows.length === 0) return null;

    const [siteRows] = await pool.query<SiteRow[]>(
        'SELECT * FROM angple_sites WHERE id = ? AND active = 1 LIMIT 1',
        [aliasRows[0].site_id]
    );
    return siteRows.length > 0 ? rowToContext(siteRows[0]) : null;
}

/**
 * angple_sites 테이블 기반 host → SiteContext 해석.
 * positive 결과만 TieredCache 적용 (L1 60s, L2 300s).
 * 미설정 host 는 매번 DB lookup — 일반적으로 hot-path 도메인은 cache hit, unknown host 는 fallback resolver 로 즉시 흘러간다.
 */
export class DbSiteResolver implements SiteResolver {
    async resolve(host: string): Promise<SiteContext | null> {
        const key = host.toLowerCase();
        if (missCache.get(key)) return null;
        if (Date.now() < schemaUnavailableUntil) return null;

        const cached = await cache.get(key);
        if (cached) return cached;

        try {
            const found = await lookupByHost(key);
            if (found) {
                await cache.set(key, found);
                return found;
            }

            missCache.set(key, true);
            return null;
        } catch (err) {
            if (isMissingTableError(err)) {
                schemaUnavailableUntil = Date.now() + SCHEMA_RETRY_TTL_MS;
                console.error(
                    `[site-resolver] angple_sites tables unavailable, bypassing DbSiteResolver for ${SCHEMA_RETRY_TTL_MS / 1000}s`,
                    err
                );
                return null;
            }

            throw err;
        }
    }
}

export async function invalidateDbSiteCache(host: string): Promise<void> {
    await cache.delete(host.toLowerCase());
    missCache.delete(host.toLowerCase());
}
