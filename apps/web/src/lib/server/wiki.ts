/**
 * Wiki 페이지 조회 모듈 (wikiang_* 테이블 전용)
 */
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db';
import { createCache } from '$lib/server/cache';

export interface WikiPage {
    id: number;
    path: string;
    title: string;
    content: string | null;
    content_raw: string | null;
    content_type: 'markdown' | 'html' | 'wikitext';
    description: string | null;
    author_id: number | null;
    created_at: Date;
    updated_at: Date;
}

const wikiCache = createCache<WikiPage | null>({ ttl: 60_000, maxSize: 100 });

export async function getWikiPage(path: string): Promise<WikiPage | null> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return wikiCache.getOrSet(`page:${normalizedPath}`, async () => {
        const [rows] = await readPool.execute<RowDataPacket[]>(
            `SELECT id, path, title, content, content_raw, content_type,
                    description, author_id, created_at, updated_at
             FROM wikiang_pages
             WHERE path = ? AND is_published = 1
             LIMIT 1`,
            [normalizedPath]
        );

        if (rows.length === 0) return null;
        return rows[0] as WikiPage;
    });
}

export async function getRecentPages(limit: number = 10): Promise<WikiPage[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT id, path, title, description, updated_at
         FROM wikiang_pages
         WHERE is_published = 1 AND namespace_id = 0
         ORDER BY updated_at DESC
         LIMIT ${safeLimit}`
    );
    return rows as WikiPage[];
}
