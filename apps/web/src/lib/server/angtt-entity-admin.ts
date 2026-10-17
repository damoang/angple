/**
 * 앙티티 작품 관리 — 관리자 화면(/admin/angtt/entities) 서버 로직.
 *
 * 승인(pending→active) · 편집 · 병합 · 거절(pending→rejected) · 되돌리기(rejected→pending) ·
 * 수동 등록. 모든 쓰기는 한 트랜잭션이며, 처리한 관리자와 시각을 meta 에 남긴다
 * (meta.reviewed_by · meta.reviewed_at · meta.review_action).
 *
 * ⛔ 승인해도 meta.auto_link 는 켜지 않는다. 자유게시판 자동 연결은 편집에서 따로 켠다.
 * ⛔ 권한 판정은 이 모듈이 하지 않는다 — 호출하는 API 라우트가 requireAdmin 으로 막는다.
 */
import pool from '$lib/server/db';
import {
    asIdArray,
    asMetaObject,
    asStringArray,
    dedupeNames,
    isEntityType,
    parseNameList,
    slugError,
    uniqueSlug
} from './angtt-candidate-logic';
import { CANDIDATE_BOARD } from './angtt-candidates';
import { isSecretOption } from './secret-option';
import { refreshEntityAggregates } from '$plugins/angtt-review/lib/entities.server';

/** 작품 단위 별점·항목 평점의 bo_table 규약 (entities.server 의 ENTITY_RATING_BO_TABLE 과 같다) */
const ENTITY_BO_TABLE = '@entity';

/** 관리자 동작 실패 — HTTP 상태와 사람이 읽을 사유 */
export class EntityAdminError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
    }
}

type Conn = Awaited<ReturnType<typeof pool.getConnection>>;

async function inTransaction<T>(fn: (conn: Conn) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback().catch(() => {});
        if ((err as { code?: string })?.code === 'ER_DUP_ENTRY') {
            throw new EntityAdminError(409, '같은 slug 또는 같은 종류·작품명이 이미 있습니다.');
        }
        throw err;
    } finally {
        conn.release();
    }
}

interface LockedEntity {
    id: number;
    status: string;
    type: string;
    canonicalTitle: string;
    slug: string;
    aliases: string[];
    meta: Record<string, unknown>;
    externalIds: Record<string, unknown>;
}

async function lockEntity(conn: Conn, id: number): Promise<LockedEntity> {
    const [rows] = await conn.query(
        `SELECT id, status, type, canonical_title, slug, aliases, meta, external_ids
           FROM angple_entities WHERE id = ? FOR UPDATE`,
        [id]
    );
    const r = (rows as Record<string, unknown>[])[0];
    if (!r) throw new EntityAdminError(404, '작품을 찾을 수 없습니다.');
    return {
        id: Number(r.id),
        status: String(r.status),
        type: String(r.type),
        canonicalTitle: String(r.canonical_title ?? ''),
        slug: String(r.slug ?? ''),
        aliases: asStringArray(r.aliases),
        meta: asMetaObject(r.meta),
        externalIds: asMetaObject(r.external_ids)
    };
}

function stamp(
    meta: Record<string, unknown>,
    adminId: string,
    action: string
): Record<string, unknown> {
    return {
        ...meta,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_action: action
    };
}

/** 근거 원글 중 실제로 살아 있는 angtt 공개 원글만(비밀글 제외) */
async function liveSourcePosts(conn: Conn, wrIds: number[]): Promise<number[]> {
    if (wrIds.length === 0) return [];
    const [rows] = await conn.query(
        `SELECT wr_id, wr_option FROM g5_write_angtt
          WHERE wr_id IN (?) AND wr_is_comment = 0 AND wr_deleted_at IS NULL`,
        [wrIds]
    );
    return (rows as { wr_id: number; wr_option?: string }[])
        .filter((r) => !isSecretOption(r.wr_option))
        .map((r) => Number(r.wr_id));
}

async function linkReviews(conn: Conn, entityId: number, wrIds: number[]): Promise<number> {
    let linked = 0;
    for (const wrId of await liveSourcePosts(conn, wrIds)) {
        await conn.query(
            `INSERT INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
             VALUES (?, ?, ?, 'review', NOW(3))
             ON DUPLICATE KEY UPDATE role = 'review'`,
            [entityId, CANDIDATE_BOARD, wrId]
        );
        linked++;
    }
    return linked;
}

/* ------------------------------------------------------------------ *
 * 목록
 * ------------------------------------------------------------------ */

export type AdminEntityStatus = 'pending' | 'active' | 'rejected' | 'merged';

export interface AdminEntityRow {
    id: number;
    type: string;
    canonicalTitle: string;
    slug: string;
    aliases: string[];
    posterUrl: string | null;
    externalIds: Record<string, unknown>;
    meta: Record<string, unknown>;
    releaseDate: string | null;
    status: string;
    mergedInto: number | null;
    ratingCount: number;
    ratingAvg: number;
    reviewPostCount: number;
    linkCount: number;
    createdAt: string;
    sourcePosts: { wrId: number; subject: string | null }[];
}

export interface AdminEntityList {
    items: AdminEntityRow[];
    /** 상태별 전체 개수 (탭 배지) */
    counts: Record<string, number>;
    /** 이 탭·검색 조건의 전체 개수 (페이지 계산용) */
    total: number;
    page: number;
    pageSize: number;
}

export interface MergeTarget {
    id: number;
    title: string;
    slug: string;
    status: string;
}

/** 목록 한 쪽 크기 상한 */
export const ADMIN_PAGE_SIZE_MAX = 100;

/** LIKE 패턴 — 사용자 입력의 와일드카드(% _ \\)는 글자 그대로 찾는다 */
function likePattern(q: string): string {
    return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** 작품명·slug·별칭 검색 조건 (q 가 비면 조건 없음) */
function searchClause(q: string): { sql: string; params: unknown[] } {
    const query = q.trim().slice(0, 100);
    if (!query) return { sql: '', params: [] };
    const like = likePattern(query);
    return {
        sql: ` AND (e.canonical_title LIKE ? OR e.slug LIKE ?
                    OR JSON_SEARCH(e.aliases, 'one', ?) IS NOT NULL)`,
        params: [like, like, like]
    };
}

export async function listEntitiesForAdmin(
    status: AdminEntityStatus,
    opts: { q?: string; page?: number; pageSize?: number } = {}
): Promise<AdminEntityList> {
    const pageSize = Math.max(
        1,
        Math.min(ADMIN_PAGE_SIZE_MAX, Math.floor(Number(opts.pageSize) || 30))
    );
    const page = Math.max(1, Math.floor(Number(opts.page) || 1));
    const search = searchClause(opts.q ?? '');

    const [totalRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM angple_entities e WHERE e.status = ?${search.sql}`,
        [status, ...search.params]
    );
    const total = Number((totalRows as { cnt?: number }[])[0]?.cnt ?? 0);

    const [rows] = await pool.query(
        `SELECT e.id, e.type, e.canonical_title, e.slug, e.aliases, e.poster_url, e.external_ids,
                e.meta, DATE_FORMAT(e.release_date, '%Y-%m-%d') AS release_date, e.status,
                e.merged_into, e.rating_count, e.rating_avg, e.review_post_count,
                DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i') AS created_at,
                (SELECT COUNT(*) FROM angple_entity_posts p WHERE p.entity_id = e.id) AS link_count
           FROM angple_entities e
          WHERE e.status = ?${search.sql}
          ORDER BY e.id DESC
          LIMIT ? OFFSET ?`,
        [status, ...search.params, pageSize, (page - 1) * pageSize]
    );

    const items: AdminEntityRow[] = (rows as Record<string, unknown>[]).map((r) => {
        const meta = asMetaObject(r.meta);
        return {
            id: Number(r.id),
            type: String(r.type),
            canonicalTitle: String(r.canonical_title ?? ''),
            slug: String(r.slug ?? ''),
            aliases: asStringArray(r.aliases),
            posterUrl: r.poster_url ? String(r.poster_url) : null,
            externalIds: asMetaObject(r.external_ids),
            meta,
            releaseDate: r.release_date ? String(r.release_date) : null,
            status: String(r.status),
            mergedInto: r.merged_into == null ? null : Number(r.merged_into),
            ratingCount: Number(r.rating_count ?? 0),
            ratingAvg: Number(r.rating_avg ?? 0),
            reviewPostCount: Number(r.review_post_count ?? 0),
            linkCount: Number(r.link_count ?? 0),
            createdAt: String(r.created_at ?? ''),
            sourcePosts: asIdArray(meta.source_posts).map((wrId) => ({ wrId, subject: null }))
        };
    });

    // 근거 원글 제목 — 이 쪽 분량만 한 번에 조회
    const wrIds = [...new Set(items.flatMap((i) => i.sourcePosts.map((p) => p.wrId)))];
    if (wrIds.length > 0) {
        const [postRows] = await pool.query(
            `SELECT wr_id, wr_subject FROM g5_write_angtt WHERE wr_id IN (?) AND wr_is_comment = 0`,
            [wrIds]
        );
        const subjects = new Map(
            (postRows as { wr_id: number; wr_subject: string }[]).map((p) => [
                Number(p.wr_id),
                String(p.wr_subject ?? '')
            ])
        );
        for (const item of items) {
            for (const p of item.sourcePosts) p.subject = subjects.get(p.wrId) ?? null;
        }
    }

    const [countRows] = await pool.query(
        `SELECT status, COUNT(*) AS cnt FROM angple_entities GROUP BY status`
    );
    const counts: Record<string, number> = {};
    for (const c of countRows as { status: string; cnt: number }[]) {
        counts[String(c.status)] = Number(c.cnt);
    }

    return { items, counts, total, page, pageSize };
}

/**
 * 병합 대상 검색 — 활성·대기 작품 중 검색어에 맞는 것 최대 50개 (활성 먼저).
 * 원본이 활성이면 활성 대상만 고를 수 있다(mergeEntity 와 같은 규칙).
 */
export async function searchMergeTargets(
    q: string,
    opts: { excludeId?: number; activeOnly?: boolean } = {}
): Promise<MergeTarget[]> {
    const search = searchClause(q);
    const statuses = opts.activeOnly ? ['active'] : ['active', 'pending'];
    const [rows] = await pool.query(
        `SELECT e.id, e.canonical_title, e.slug, e.status FROM angple_entities e
          WHERE e.status IN (?) AND e.id <> ?${search.sql}
          ORDER BY e.status = 'active' DESC, e.canonical_title
          LIMIT 50`,
        [statuses, Number(opts.excludeId) || 0, ...search.params]
    );
    return (rows as Record<string, unknown>[]).map((t) => ({
        id: Number(t.id),
        title: String(t.canonical_title ?? ''),
        slug: String(t.slug ?? ''),
        status: String(t.status)
    }));
}

/* ------------------------------------------------------------------ *
 * 입력 검증
 * ------------------------------------------------------------------ */

export interface EntityEditInput {
    canonicalTitle?: unknown;
    slug?: unknown;
    aliases?: unknown;
    type?: unknown;
    releaseDate?: unknown;
    posterUrl?: unknown;
    autoLink?: unknown;
    contextTerms?: unknown;
    /** TMDB 에서 고른 작품 id (null 이면 지움) */
    tmdbId?: unknown;
    /** 'movie' | 'tv' */
    tmdbKind?: unknown;
}

function cleanTitle(v: unknown): string {
    const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
    if (!t) throw new EntityAdminError(400, '작품명을 입력해 주세요.');
    if (t.length > 255) throw new EntityAdminError(400, '작품명이 너무 깁니다.');
    return t;
}

function cleanSlug(v: unknown): string {
    const s = typeof v === 'string' ? v.trim() : '';
    const err = slugError(s);
    if (err) throw new EntityAdminError(400, err);
    return s;
}

function cleanType(v: unknown): string {
    if (!isEntityType(v)) throw new EntityAdminError(400, '작품 종류가 올바르지 않습니다.');
    return v;
}

function cleanDate(v: unknown): string | null {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = m ? new Date(`${s}T00:00:00Z`) : null;
    if (!m || !d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
        throw new EntityAdminError(400, '개봉일은 YYYY-MM-DD 형식이어야 합니다.');
    }
    return s;
}

function cleanPosterUrl(v: unknown): string | null {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    let url: URL;
    try {
        url = new URL(s);
    } catch {
        throw new EntityAdminError(400, '포스터 주소가 올바르지 않습니다.');
    }
    if (url.protocol !== 'https:' || s.length > 500) {
        throw new EntityAdminError(
            400,
            '포스터 주소는 https 로 시작하는 500자 이하 주소여야 합니다.'
        );
    }
    return s;
}

/* ------------------------------------------------------------------ *
 * 쓰기
 * ------------------------------------------------------------------ */

/** 편집 — 넘어온 필드만 바꾼다 */
export async function updateEntity(
    id: number,
    input: EntityEditInput,
    adminId: string
): Promise<void> {
    await inTransaction(async (conn) => {
        const cur = await lockEntity(conn, id);
        if (cur.status === 'merged') {
            throw new EntityAdminError(409, '병합된 작품은 편집할 수 없습니다.');
        }

        const sets: string[] = [];
        const params: unknown[] = [];
        const title =
            input.canonicalTitle !== undefined
                ? cleanTitle(input.canonicalTitle)
                : cur.canonicalTitle;

        if (input.canonicalTitle !== undefined) {
            sets.push('canonical_title = ?');
            params.push(title);
        }
        if (input.slug !== undefined) {
            sets.push('slug = ?');
            params.push(cleanSlug(input.slug));
        }
        if (input.type !== undefined) {
            sets.push('type = ?');
            params.push(cleanType(input.type));
        }
        if (input.aliases !== undefined || input.canonicalTitle !== undefined) {
            const list = input.aliases !== undefined ? parseNameList(input.aliases) : cur.aliases;
            sets.push('aliases = ?');
            params.push(JSON.stringify(dedupeNames([title, ...list])));
        }
        if (input.releaseDate !== undefined) {
            sets.push('release_date = ?');
            params.push(cleanDate(input.releaseDate));
        }
        if (input.posterUrl !== undefined) {
            sets.push('poster_url = ?');
            params.push(cleanPosterUrl(input.posterUrl));
        }
        if (input.tmdbId !== undefined) {
            const ext = { ...cur.externalIds };
            const tmdbId = Number(input.tmdbId);
            if (input.tmdbId === null || input.tmdbId === '') {
                delete ext.tmdb;
                delete ext.tmdb_type;
            } else if (Number.isInteger(tmdbId) && tmdbId > 0) {
                ext.tmdb = tmdbId;
                ext.tmdb_type = input.tmdbKind === 'tv' ? 'tv' : 'movie';
            } else {
                throw new EntityAdminError(400, 'TMDB id 가 올바르지 않습니다.');
            }
            sets.push('external_ids = ?');
            params.push(Object.keys(ext).length > 0 ? JSON.stringify(ext) : null);
        }

        const meta = { ...cur.meta };
        if (input.autoLink !== undefined) meta.auto_link = input.autoLink === true;
        if (input.contextTerms !== undefined) {
            const terms = parseNameList(input.contextTerms, 100);
            if (terms.length > 0) meta.context_terms = terms;
            else delete meta.context_terms;
        }
        sets.push('meta = ?');
        params.push(JSON.stringify(stamp(meta, adminId, 'edit')));

        await conn.query(`UPDATE angple_entities SET ${sets.join(', ')} WHERE id = ?`, [
            ...params,
            id
        ]);
    });
}

/** 승인 — pending → active, 근거 원글을 후기로 연결, 집계 갱신 */
export async function approveEntity(id: number, adminId: string): Promise<{ linked: number }> {
    return inTransaction(async (conn) => {
        const cur = await lockEntity(conn, id);
        if (cur.status !== 'pending') {
            throw new EntityAdminError(409, '대기 중인 작품만 승인할 수 있습니다.');
        }
        const linked = await linkReviews(conn, id, asIdArray(cur.meta.source_posts));
        const meta = stamp(cur.meta, adminId, 'approve');
        // 승인이 자동 연결을 켜지 않는다 — 명시적으로 켠 경우만 유지
        if (meta.auto_link !== true) meta.auto_link = false;
        await conn.query(`UPDATE angple_entities SET status = 'active', meta = ? WHERE id = ?`, [
            JSON.stringify(meta),
            id
        ]);
        await refreshEntityAggregates(id, conn);
        return { linked };
    });
}

/**
 * status enum 에 'rejected' 가 있는지. DDL 적용 전에는 거절을 막는다.
 *
 * ⛔ 이 DB 는 strict 모드가 아니어서, enum 에 없는 값을 넣으면 오류 없이 빈 값('')이 저장된다.
 *    그러면 그 작품은 어느 탭에도 안 보이는 유령이 된다. 그래서 쓰기 전에 확인하고,
 *    쓴 뒤에도 다시 읽어 확인한다.
 */
async function supportsRejected(conn: Conn): Promise<boolean> {
    const [rows] = await conn.query(
        `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'angple_entities'
            AND COLUMN_NAME = 'status'`
    );
    const t = String((rows as { t?: string }[])[0]?.t ?? '');
    return t.includes("'rejected'");
}

async function setStatusVerified(
    conn: Conn,
    id: number,
    status: 'rejected' | 'pending',
    meta: Record<string, unknown>
): Promise<void> {
    await conn.query(`UPDATE angple_entities SET status = ?, meta = ? WHERE id = ?`, [
        status,
        JSON.stringify(meta),
        id
    ]);
    const [rows] = await conn.query(`SELECT status FROM angple_entities WHERE id = ?`, [id]);
    if (String((rows as { status?: string }[])[0]?.status ?? '') !== status) {
        throw new EntityAdminError(500, '상태 저장을 확인하지 못해 되돌렸습니다.');
    }
}

/** 거절 — pending → rejected. 연결된 글이 있으면 거절하지 않는다(병합을 써야 한다). */
export async function rejectEntity(id: number, adminId: string): Promise<void> {
    await inTransaction(async (conn) => {
        if (!(await supportsRejected(conn))) {
            throw new EntityAdminError(
                503,
                '거절 상태가 아직 DB 에 없습니다. 상태 enum 변경을 먼저 적용해야 합니다.'
            );
        }
        const cur = await lockEntity(conn, id);
        if (cur.status !== 'pending') {
            throw new EntityAdminError(409, '대기 중인 작품만 거절할 수 있습니다.');
        }
        const [linkRows] = await conn.query(
            `SELECT COUNT(*) AS cnt FROM angple_entity_posts WHERE entity_id = ?`,
            [id]
        );
        if (Number((linkRows as { cnt?: number }[])[0]?.cnt ?? 0) > 0) {
            throw new EntityAdminError(409, '연결된 글이 있어 거절할 수 없습니다. 병합을 쓰세요.');
        }
        await setStatusVerified(conn, id, 'rejected', stamp(cur.meta, adminId, 'reject'));
    });
}

/** 거절 되돌리기 — rejected → pending */
export async function restoreEntity(id: number, adminId: string): Promise<void> {
    await inTransaction(async (conn) => {
        const cur = await lockEntity(conn, id);
        if (cur.status !== 'rejected') {
            throw new EntityAdminError(409, '거절된 작품만 되돌릴 수 있습니다.');
        }
        await setStatusVerified(conn, id, 'pending', stamp(cur.meta, adminId, 'restore'));
    });
}

export interface MergeResult {
    movedLinks: number;
    movedRatings: number;
}

/**
 * 병합 — source 를 target 에 합친다.
 *  - target.aliases ∪= source 작품명·별칭
 *  - 연결 글(angple_entity_posts) 이전. 같은 글이 양쪽에 있으면 강한 role(review>mention>auto)
 *  - 작품 별점·항목 평점(bo_table='@entity') 이전. 같은 회원이 양쪽에 남겼으면 최신 표만 남김
 *  - 글 별점의 entity_id, 연결 제안, 구 별칭 색인도 target 으로
 *  - source.status='merged', merged_into=target, 집계 0 / target 집계 재계산
 */
export async function mergeEntity(
    sourceId: number,
    targetId: number,
    adminId: string
): Promise<MergeResult> {
    if (!Number.isInteger(targetId) || targetId <= 0 || sourceId === targetId) {
        throw new EntityAdminError(400, '병합 대상이 올바르지 않습니다.');
    }
    return inTransaction(async (conn) => {
        // 잠금 순서를 id 순으로 고정해 교착을 피한다
        const [firstId, secondId] =
            sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
        const first = await lockEntity(conn, firstId);
        const second = await lockEntity(conn, secondId);
        const source = first.id === sourceId ? first : second;
        const target = first.id === targetId ? first : second;

        if (!['pending', 'active', 'rejected'].includes(source.status)) {
            throw new EntityAdminError(409, '이미 병합된 작품입니다.');
        }
        if (!['pending', 'active'].includes(target.status)) {
            throw new EntityAdminError(409, '병합 대상은 활성 또는 대기 작품이어야 합니다.');
        }
        // 활성 작품의 연결 글·별점이 대기 작품으로 옮겨가면 공개 화면에서 사라진다
        if (source.status === 'active' && target.status !== 'active') {
            throw new EntityAdminError(
                409,
                '활성 작품은 활성 작품에만 병합할 수 있습니다. 대상을 먼저 승인하세요.'
            );
        }

        // 1) 연결 글 이전 (강한 role 유지)
        const [linkRows] = await conn.query(
            `SELECT bo_table, wr_id, role, created_at FROM angple_entity_posts WHERE entity_id = ?`,
            [sourceId]
        );
        const links = linkRows as {
            bo_table: string;
            wr_id: number;
            role: string;
            created_at: unknown;
        }[];
        for (const l of links) {
            await conn.query(
                `INSERT INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE role = CASE
                     WHEN role = 'review' OR VALUES(role) = 'review' THEN 'review'
                     WHEN role = 'mention' OR VALUES(role) = 'mention' THEN 'mention'
                     ELSE 'auto' END`,
                [targetId, l.bo_table, l.wr_id, l.role || 'mention', l.created_at ?? new Date()]
            );
        }
        await conn.query(`DELETE FROM angple_entity_posts WHERE entity_id = ?`, [sourceId]);

        // 2) 근거 원글: target 이 active 면 후기로 연결, pending 이면 근거 목록에 합친다
        const sourcePosts = asIdArray(source.meta.source_posts);
        const targetMeta = { ...target.meta };
        if (target.status === 'active') {
            await linkReviews(conn, targetId, sourcePosts);
        } else {
            targetMeta.source_posts = [
                ...new Set([...asIdArray(targetMeta.source_posts), ...sourcePosts])
            ];
        }
        const seasons = [
            ...new Set([...asIdArray(targetMeta.seasons), ...asIdArray(source.meta.seasons)])
        ].sort((a, b) => a - b);
        if (seasons.length > 0) targetMeta.seasons = seasons;
        targetMeta.merged_from = [...new Set([...asIdArray(targetMeta.merged_from), sourceId])];

        // 3) 작품 별점 이전 — 같은 회원이 양쪽에 남겼으면 최신 표만 남긴다
        await conn.query(
            `DELETE t FROM angple_post_ratings t
               JOIN angple_post_ratings s
                 ON s.bo_table = t.bo_table AND s.mb_id = t.mb_id AND s.wr_id = ?
              WHERE t.bo_table = ? AND t.wr_id = ?
                AND COALESCE(s.updated_at, s.created_at, '1970-01-01')
                    > COALESCE(t.updated_at, t.created_at, '1970-01-01')`,
            [sourceId, ENTITY_BO_TABLE, targetId]
        );
        await conn.query(
            `DELETE s FROM angple_post_ratings s
               JOIN angple_post_ratings t
                 ON t.bo_table = s.bo_table AND t.mb_id = s.mb_id AND t.wr_id = ?
              WHERE s.bo_table = ? AND s.wr_id = ?`,
            [targetId, ENTITY_BO_TABLE, sourceId]
        );
        const [moved] = await conn.query(
            `UPDATE angple_post_ratings SET wr_id = ?, entity_id = ?
              WHERE bo_table = ? AND wr_id = ?`,
            [targetId, targetId, ENTITY_BO_TABLE, sourceId]
        );
        const movedRatings = Number((moved as { affectedRows?: number }).affectedRows ?? 0);
        await conn.query(
            `UPDATE angple_post_ratings SET entity_id = ? WHERE entity_id = ? AND bo_table <> ?`,
            [targetId, sourceId, ENTITY_BO_TABLE]
        );

        // 4) 항목별 평점(옵트인)도 같은 규칙으로
        await conn.query(
            `DELETE t FROM angple_rating_aspects t
               JOIN angple_rating_aspects s
                 ON s.bo_table = t.bo_table AND s.mb_id = t.mb_id AND s.aspect = t.aspect
                AND s.wr_id = ?
              WHERE t.bo_table = ? AND t.wr_id = ? AND s.updated_at > t.updated_at`,
            [sourceId, ENTITY_BO_TABLE, targetId]
        );
        await conn.query(
            `DELETE s FROM angple_rating_aspects s
               JOIN angple_rating_aspects t
                 ON t.bo_table = s.bo_table AND t.mb_id = s.mb_id AND t.aspect = s.aspect
                AND t.wr_id = ?
              WHERE s.bo_table = ? AND s.wr_id = ?`,
            [targetId, ENTITY_BO_TABLE, sourceId]
        );
        await conn.query(
            `UPDATE angple_rating_aspects SET wr_id = ? WHERE bo_table = ? AND wr_id = ?`,
            [targetId, ENTITY_BO_TABLE, sourceId]
        );

        // 5) 연결 제안·구 별칭 색인
        await conn.query(
            `INSERT IGNORE INTO angple_entity_post_suggestions
                (bo_table, wr_id, entity_id, mb_id, created_at, withdrawn_at)
             SELECT bo_table, wr_id, ?, mb_id, created_at, withdrawn_at
               FROM angple_entity_post_suggestions WHERE entity_id = ?`,
            [targetId, sourceId]
        );
        await conn.query(`DELETE FROM angple_entity_post_suggestions WHERE entity_id = ?`, [
            sourceId
        ]);
        await conn.query(`UPDATE angple_entity_aliases SET entity_id = ? WHERE entity_id = ?`, [
            targetId,
            sourceId
        ]);

        // 6) 작품 행
        const aliases = dedupeNames([
            target.canonicalTitle,
            ...target.aliases,
            source.canonicalTitle,
            ...source.aliases
        ]);
        await conn.query(`UPDATE angple_entities SET aliases = ?, meta = ? WHERE id = ?`, [
            JSON.stringify(aliases),
            JSON.stringify(stamp(targetMeta, adminId, 'merge_into')),
            targetId
        ]);
        await conn.query(
            `UPDATE angple_entities
                SET status = 'merged', merged_into = ?, meta = ?,
                    rating_count = 0, rating_avg = 0, review_post_count = 0
              WHERE id = ?`,
            [targetId, JSON.stringify(stamp(source.meta, adminId, 'merge')), sourceId]
        );
        await refreshEntityAggregates(targetId, conn);

        return { movedLinks: links.length, movedRatings };
    });
}

export interface CreateEntityInput extends EntityEditInput {
    /** 'active'(기본) | 'pending' */
    status?: unknown;
}

/** 수동 등록 — 관리자가 직접 만드는 작품. 기본 active, auto_link 꺼짐 */
export async function createEntity(input: CreateEntityInput, adminId: string): Promise<number> {
    const title = cleanTitle(input.canonicalTitle);
    const type = cleanType(input.type);
    const status = input.status === 'pending' ? 'pending' : 'active';
    const aliases = dedupeNames([title, ...parseNameList(input.aliases)]);
    const releaseDate = cleanDate(input.releaseDate);
    const posterUrl = cleanPosterUrl(input.posterUrl);
    const contextTerms = parseNameList(input.contextTerms, 100);

    return inTransaction(async (conn) => {
        let slug: string;
        if (typeof input.slug === 'string' && input.slug.trim()) {
            slug = cleanSlug(input.slug);
        } else {
            const [rows] = await conn.query(`SELECT slug FROM angple_entities`);
            const taken = new Set((rows as { slug: string }[]).map((r) => r.slug.toLowerCase()));
            const generated = uniqueSlug(title, taken);
            if (!generated)
                throw new EntityAdminError(400, 'slug 를 만들 수 없습니다. 직접 입력해 주세요.');
            slug = generated;
        }

        const ext: Record<string, unknown> = {};
        const tmdbId = Number(input.tmdbId);
        if (Number.isInteger(tmdbId) && tmdbId > 0) {
            ext.tmdb = tmdbId;
            ext.tmdb_type = input.tmdbKind === 'tv' ? 'tv' : 'movie';
        }

        const meta: Record<string, unknown> = {
            source: 'admin',
            auto_link: input.autoLink === true
        };
        if (contextTerms.length > 0) meta.context_terms = contextTerms;

        const [res] = await conn.query(
            `INSERT INTO angple_entities
               (type, canonical_title, slug, aliases, poster_url, external_ids, meta,
                release_date, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
            [
                type,
                title,
                slug,
                JSON.stringify(aliases),
                posterUrl,
                Object.keys(ext).length > 0 ? JSON.stringify(ext) : null,
                JSON.stringify(stamp(meta, adminId, 'create')),
                releaseDate,
                status
            ]
        );
        return Number((res as { insertId?: number }).insertId ?? 0);
    });
}
