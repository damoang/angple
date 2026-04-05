/**
 * Wiki 페이지 조회 모듈 (wikiang_* 테이블 전용)
 *
 * Sprint 1: 전체 API 계층 완성
 * - 페이지 조회, 리비전 조회/비교, 카테고리/태그, 검색
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { readPool, pool } from '$lib/server/db';
import { createCache } from '$lib/server/cache';

// ============================================
// 타입 정의
// ============================================

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

export interface WikiRevision {
    id: number;
    page_id: number;
    content: string | null;
    content_raw: string | null;
    content_type: 'markdown' | 'html' | 'wikitext';
    version_number: number;
    version_date: Date;
    comment: string | null;
    is_minor: boolean;
    author_id: number | null;
    author_name: string | null;
    size: number;
    delta: number;
}

export interface WikiCategory {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parent_id: number | null;
    page_count: number;
}

export interface WikiTag {
    id: number;
    tag: string;
    slug: string;
    title: string | null;
    page_count?: number;
}

export interface WikiPageSummary {
    id: number;
    path: string;
    title: string;
    description: string | null;
    updated_at: Date;
}

export interface WikiSearchResult {
    id: number;
    path: string;
    title: string;
    description: string | null;
    snippet: string | null;
    updated_at: Date;
    score: number;
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
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

export async function getRecentPages(limit: number = 10): Promise<WikiPageSummary[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT id, path, title, description, updated_at
         FROM wikiang_pages
         WHERE is_published = 1 AND namespace_id = 0
         ORDER BY updated_at DESC
         LIMIT ${safeLimit}`
    );
    return rows as WikiPageSummary[];
}

// ============================================
// 리비전 조회
// ============================================

const revisionCache = createCache<WikiRevision[]>({ ttl: 30_000, maxSize: 50 });

/**
 * 페이지의 리비전 목록 조회
 */
export async function getPageRevisions(
    pageId: number,
    limit: number = 50
): Promise<WikiRevision[]> {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));

    return revisionCache.getOrSet(`revisions:${pageId}:${safeLimit}`, async () => {
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT r.id, r.page_id, r.content, r.content_raw, r.content_type,
                    r.version_number, r.version_date, r.comment, r.is_minor,
                    r.author_id, r.size, r.delta,
                    u.display_name AS author_name
             FROM wikiang_revisions r
             LEFT JOIN wikiang_users u ON r.author_id = u.id
             WHERE r.page_id = ?
             ORDER BY r.version_number DESC
             LIMIT ${safeLimit}`,
            [pageId]
        );
        return rows as WikiRevision[];
    });
}

/**
 * 특정 리비전 조회
 */
export async function getRevisionById(revisionId: number): Promise<WikiRevision | null> {
    const [rows] = await readPool.execute<RowDataPacket[]>(
        `SELECT r.id, r.page_id, r.content, r.content_raw, r.content_type,
                r.version_number, r.version_date, r.comment, r.is_minor,
                r.author_id, r.size, r.delta,
                u.display_name AS author_name
         FROM wikiang_revisions r
         LEFT JOIN wikiang_users u ON r.author_id = u.id
         WHERE r.id = ?
         LIMIT 1`,
        [revisionId]
    );

    if (rows.length === 0) return null;
    return rows[0] as WikiRevision;
}

/**
 * 두 리비전 간 비교를 위한 데이터 조회
 * 실제 diff 계산은 클라이언트에서 처리 (diff-match-patch 등 사용)
 */
export async function getRevisionPair(
    revId1: number,
    revId2: number
): Promise<{ old: WikiRevision | null; new: WikiRevision | null }> {
    const [rev1, rev2] = await Promise.all([getRevisionById(revId1), getRevisionById(revId2)]);

    // 버전 순서 정렬 (낮은 번호가 old)
    if (rev1 && rev2 && rev1.version_number > rev2.version_number) {
        return { old: rev2, new: rev1 };
    }
    return { old: rev1, new: rev2 };
}

// ============================================
// 카테고리 조회
// ============================================

const categoryCache = createCache<WikiCategory[]>({ ttl: 300_000, maxSize: 10 });

/**
 * 전체 카테고리 목록 조회
 */
export async function getCategories(): Promise<WikiCategory[]> {
    return categoryCache.getOrSet('all', async () => {
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT id, name, slug, description, parent_id, page_count
             FROM wikiang_categories
             ORDER BY name ASC`
        );
        return rows as WikiCategory[];
    });
}

/**
 * 특정 카테고리에 속한 페이지 목록 조회
 */
export async function getPagesByCategory(
    categoryId: number,
    offset: number = 0,
    limit: number = 50
): Promise<PaginatedResult<WikiPageSummary>> {
    const safeOffset = Math.max(0, Math.floor(offset));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const [[countResult], [rows]] = await Promise.all([
        readPool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total
             FROM wikiang_page_categories pc
             JOIN wikiang_pages p ON pc.page_id = p.id
             WHERE pc.category_id = ? AND p.is_published = 1`,
            [categoryId]
        ),
        readPool.query<RowDataPacket[]>(
            `SELECT p.id, p.path, p.title, p.description, p.updated_at
             FROM wikiang_page_categories pc
             JOIN wikiang_pages p ON pc.page_id = p.id
             WHERE pc.category_id = ? AND p.is_published = 1
             ORDER BY pc.sort_key ASC, p.title ASC
             LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [categoryId]
        )
    ]);

    const total = (countResult[0] as { total: number }).total;

    return {
        items: rows as WikiPageSummary[],
        total,
        offset: safeOffset,
        limit: safeLimit,
        hasMore: safeOffset + rows.length < total
    };
}

// ============================================
// 태그 조회
// ============================================

const tagCache = createCache<WikiTag[]>({ ttl: 300_000, maxSize: 10 });

/**
 * 전체 태그 목록 조회 (페이지 수 포함)
 */
export async function getTags(): Promise<WikiTag[]> {
    return tagCache.getOrSet('all', async () => {
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT t.id, t.tag, t.slug, t.title,
                    COUNT(pt.page_id) as page_count
             FROM wikiang_tags t
             LEFT JOIN wikiang_page_tags pt ON t.id = pt.tag_id
             LEFT JOIN wikiang_pages p ON pt.page_id = p.id AND p.is_published = 1
             GROUP BY t.id
             ORDER BY t.tag ASC`
        );
        return rows as WikiTag[];
    });
}

/**
 * 특정 태그에 속한 페이지 목록 조회
 */
export async function getPagesByTag(
    tagId: number,
    offset: number = 0,
    limit: number = 50
): Promise<PaginatedResult<WikiPageSummary>> {
    const safeOffset = Math.max(0, Math.floor(offset));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const [[countResult], [rows]] = await Promise.all([
        readPool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total
             FROM wikiang_page_tags pt
             JOIN wikiang_pages p ON pt.page_id = p.id
             WHERE pt.tag_id = ? AND p.is_published = 1`,
            [tagId]
        ),
        readPool.query<RowDataPacket[]>(
            `SELECT p.id, p.path, p.title, p.description, p.updated_at
             FROM wikiang_page_tags pt
             JOIN wikiang_pages p ON pt.page_id = p.id
             WHERE pt.tag_id = ? AND p.is_published = 1
             ORDER BY p.title ASC
             LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [tagId]
        )
    ]);

    const total = (countResult[0] as { total: number }).total;

    return {
        items: rows as WikiPageSummary[],
        total,
        offset: safeOffset,
        limit: safeLimit,
        hasMore: safeOffset + rows.length < total
    };
}

// ============================================
// 검색
// ============================================

/**
 * FULLTEXT 검색 (title, content 대상)
 */
export async function searchPages(
    query: string,
    offset: number = 0,
    limit: number = 20
): Promise<PaginatedResult<WikiSearchResult>> {
    const safeOffset = Math.max(0, Math.floor(offset));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    // 빈 쿼리 처리
    if (!query || query.trim().length === 0) {
        return { items: [], total: 0, offset: safeOffset, limit: safeLimit, hasMore: false };
    }

    const searchTerm = query.trim();
    // LIKE 검색용 패턴 (FULLTEXT가 없는 경우 대비)
    const likePattern = `%${searchTerm}%`;

    // FULLTEXT 인덱스가 있다면 MATCH AGAINST 사용, 없으면 LIKE로 fallback
    // 현재는 LIKE 검색으로 구현 (안정성 우선)
    const [[countResult], [rows]] = await Promise.all([
        readPool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total
             FROM wikiang_pages
             WHERE is_published = 1
               AND (title LIKE ? OR content_raw LIKE ? OR description LIKE ?)`,
            [likePattern, likePattern, likePattern]
        ),
        readPool.query<RowDataPacket[]>(
            `SELECT id, path, title, description, updated_at,
                    CASE
                        WHEN title LIKE ? THEN 100
                        WHEN description LIKE ? THEN 50
                        ELSE 10
                    END as score,
                    SUBSTRING(content_raw, 1, 200) as snippet
             FROM wikiang_pages
             WHERE is_published = 1
               AND (title LIKE ? OR content_raw LIKE ? OR description LIKE ?)
             ORDER BY score DESC, updated_at DESC
             LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [likePattern, likePattern, likePattern, likePattern, likePattern]
        )
    ]);

    const total = (countResult[0] as { total: number }).total;

    return {
        items: rows as WikiSearchResult[],
        total,
        offset: safeOffset,
        limit: safeLimit,
        hasMore: safeOffset + rows.length < total
    };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 임의의 페이지 조회 (Special:Random용)
 */
export async function getRandomPage(): Promise<WikiPageSummary | null> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT id, path, title, description, updated_at
         FROM wikiang_pages
         WHERE is_published = 1 AND namespace_id = 0
         ORDER BY RAND()
         LIMIT 1`
    );

    if (rows.length === 0) return null;
    return rows[0] as WikiPageSummary;
}

/**
 * 전체 페이지 목록 (페이지네이션)
 */
export async function getAllPages(
    offset: number = 0,
    limit: number = 50,
    sortBy: 'title' | 'updated' = 'title'
): Promise<PaginatedResult<WikiPageSummary>> {
    const safeOffset = Math.max(0, Math.floor(offset));
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const orderClause = sortBy === 'updated' ? 'updated_at DESC' : 'title ASC';

    const [[countResult], [rows]] = await Promise.all([
        readPool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM wikiang_pages WHERE is_published = 1 AND namespace_id = 0`
        ),
        readPool.query<RowDataPacket[]>(
            `SELECT id, path, title, description, updated_at
             FROM wikiang_pages
             WHERE is_published = 1 AND namespace_id = 0
             ORDER BY ${orderClause}
             LIMIT ${safeLimit} OFFSET ${safeOffset}`
        )
    ]);

    const total = (countResult[0] as { total: number }).total;

    return {
        items: rows as WikiPageSummary[],
        total,
        offset: safeOffset,
        limit: safeLimit,
        hasMore: safeOffset + rows.length < total
    };
}

/**
 * 페이지 ID로 조회 (리비전 페이지에서 사용)
 */
export async function getWikiPageById(pageId: number): Promise<WikiPage | null> {
    const [rows] = await readPool.execute<RowDataPacket[]>(
        `SELECT id, path, title, content, content_raw, content_type,
                description, author_id, created_at, updated_at
         FROM wikiang_pages
         WHERE id = ? AND is_published = 1
         LIMIT 1`,
        [pageId]
    );

    if (rows.length === 0) return null;
    return rows[0] as WikiPage;
}

/**
 * path로 페이지 ID 조회
 */
export async function getPageIdByPath(path: string): Promise<number | null> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const [rows] = await readPool.execute<RowDataPacket[]>(
        `SELECT id FROM wikiang_pages WHERE path = ? AND is_published = 1 LIMIT 1`,
        [normalizedPath]
    );

    if (rows.length === 0) return null;
    return (rows[0] as { id: number }).id;
}

// ============================================
// 페이지 생성/수정
// ============================================

export interface WikiPageInput {
    title: string;
    content: string;
    content_raw: string;
    content_type?: 'markdown' | 'html' | 'wikitext';
    description?: string;
    comment?: string;
    is_minor?: boolean;
}

/**
 * 신규 위키 페이지 생성
 */
export async function createWikiPage(
    path: string,
    input: WikiPageInput,
    authorId: number
): Promise<{ pageId: number; revisionId: number }> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const contentType = input.content_type || 'html';
    const size = Buffer.byteLength(input.content_raw || '', 'utf8');

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 페이지 생성
        const [pageResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO wikiang_pages
             (path, title, content, content_raw, content_type, description, author_id, is_published, namespace_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
            [
                normalizedPath,
                input.title,
                input.content,
                input.content_raw,
                contentType,
                input.description || null,
                authorId
            ]
        );
        const pageId = pageResult.insertId;

        // 2. 리비전 생성 (버전 1)
        const [revResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO wikiang_revisions
             (page_id, content, content_raw, content_type, version_number, version_date, comment, is_minor, author_id, size, delta)
             VALUES (?, ?, ?, ?, 1, NOW(), ?, ?, ?, ?, ?)`,
            [
                pageId,
                input.content,
                input.content_raw,
                contentType,
                input.comment || '문서 생성',
                input.is_minor || false,
                authorId,
                size,
                size
            ]
        );

        await connection.commit();

        // 캐시 무효화
        wikiCache.delete(`page:${normalizedPath}`);

        return { pageId, revisionId: revResult.insertId };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 기존 위키 페이지 수정
 */
export async function updateWikiPage(
    pageId: number,
    input: WikiPageInput,
    authorId: number
): Promise<{ revisionId: number; versionNumber: number }> {
    const contentType = input.content_type || 'html';
    const newSize = Buffer.byteLength(input.content_raw || '', 'utf8');

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 현재 페이지 정보 조회 (이전 크기, 경로)
        const [pageRows] = await connection.execute<RowDataPacket[]>(
            `SELECT path, content_raw FROM wikiang_pages WHERE id = ? LIMIT 1`,
            [pageId]
        );
        if (pageRows.length === 0) {
            throw new Error('페이지를 찾을 수 없습니다.');
        }
        const currentPage = pageRows[0] as { path: string; content_raw: string | null };
        const prevSize = Buffer.byteLength(currentPage.content_raw || '', 'utf8');
        const delta = newSize - prevSize;

        // 2. 최신 버전 번호 조회
        const [versionRows] = await connection.execute<RowDataPacket[]>(
            `SELECT MAX(version_number) as max_version FROM wikiang_revisions WHERE page_id = ?`,
            [pageId]
        );
        const maxVersion = (versionRows[0] as { max_version: number | null }).max_version || 0;
        const newVersionNumber = maxVersion + 1;

        // 3. 페이지 업데이트
        await connection.execute(
            `UPDATE wikiang_pages
             SET title = ?, content = ?, content_raw = ?, content_type = ?, description = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                input.title,
                input.content,
                input.content_raw,
                contentType,
                input.description || null,
                pageId
            ]
        );

        // 4. 새 리비전 생성
        const [revResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO wikiang_revisions
             (page_id, content, content_raw, content_type, version_number, version_date, comment, is_minor, author_id, size, delta)
             VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
            [
                pageId,
                input.content,
                input.content_raw,
                contentType,
                newVersionNumber,
                input.comment || '',
                input.is_minor || false,
                authorId,
                newSize,
                delta
            ]
        );

        await connection.commit();

        // 캐시 무효화
        wikiCache.delete(`page:${currentPage.path}`);
        revisionCache.delete(`revisions:${pageId}:50`);
        revisionCache.delete(`revisions:${pageId}:100`);

        return { revisionId: revResult.insertId, versionNumber: newVersionNumber };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * path로 페이지 조회 (비공개 포함, 편집용)
 */
export async function getWikiPageForEdit(path: string): Promise<WikiPage | null> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const [rows] = await readPool.execute<RowDataPacket[]>(
        `SELECT id, path, title, content, content_raw, content_type,
                description, author_id, created_at, updated_at
         FROM wikiang_pages
         WHERE path = ?
         LIMIT 1`,
        [normalizedPath]
    );

    if (rows.length === 0) return null;
    return rows[0] as WikiPage;
}
