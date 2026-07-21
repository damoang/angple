/**
 * 앙티티 리뷰 — 작품(엔티티) 조회 서버 로직 (읽기 전용)
 *
 * 데이터 소스(전부 prod 생성 완료, 이 파일은 읽기만 한다):
 *   - angple_entities          작품 마스터 + 집계(rating_count/avg, review_post_count)
 *   - angple_entity_aliases    normalize(별칭) → entity_id (정확 일치 매칭)
 *   - angple_entity_posts      작품 ↔ 글 연결 (bo_table, wr_id, role)
 *   - angple_post_ratings      작품/글 별점
 *
 * ⚠️ 조인 규약: angple_entity_posts 와 실제 글은 wr_id(int)로만 잇는다. 문자열
 *    bo_table 로 g5_write_* 를 크로스조인하면 collation 1267 이 난다. 그래서 여기서는
 *    보드별로 그룹핑해 각 g5_write_{board} 를 동적 테이블명(??)으로 개별 조회한다.
 *
 * 타입 주: mysql2 는 apps/web 에만 설치돼 plugins/ 경로에서 'mysql2' 타입을 해석하지
 * 못한다. 그래서 RowDataPacket 제네릭 대신 pool.query(...) 결과를 캐스팅한다
 * (affiliate-link-private 플러그인과 동일 관례).
 */
import pool from '$lib/server/db';
import { hasAngttTag, normalizeWorkTitle } from './normalize';

/** 작품 단위 회원 1표 별점의 저장 규약: 작품 페이지 별점은 bo_table 을 이 상수로 둔다. */
export const ENTITY_RATING_BO_TABLE = '@entity';

/** 작품(엔티티) 표시 모델 */
export interface AngttEntity {
    id: number;
    type: string;
    canonicalTitle: string;
    slug: string;
    aliases: string[];
    posterUrl: string | null;
    externalIds: Record<string, unknown> | null;
    meta: Record<string, unknown> | null;
    releaseDate: string | null;
    status: string;
    ratingCount: number;
    ratingAvg: number;
    reviewPostCount: number;
}

/** 작품에 연결된 커뮤니티 글 1건 */
export interface AngttConnectedPost {
    boTable: string;
    wrId: number;
    role: 'review' | 'mention' | string;
    subject: string;
    name: string;
    mbId: string;
    good: number;
    datetime: string;
}

/** 작품 단위 별점 집계(+요청자 본인 표) */
export interface AngttEntityRating {
    avg: number;
    count: number;
    /** 로그인 사용자 본인이 이 작품에 남긴 별점(없으면 null) */
    my: number | null;
}

/** 태그 → 작품 해석 결과 */
export type ResolveEntityResult =
    | { entity: AngttEntity }
    | { notFound: true; query: string | null };

interface EntityRow {
    id: number;
    type: string;
    canonical_title: string;
    slug: string;
    aliases: unknown;
    poster_url: string | null;
    external_ids: unknown;
    meta: unknown;
    release_date: string | null;
    status: string;
    rating_count: number | null;
    rating_avg: number | string | null;
    review_post_count: number | null;
}

interface AliasRow {
    alias_norm: string;
    entity_id: number;
}

interface LinkRow {
    bo_table: string;
    wr_id: number;
    role: string;
}

interface WriteRow {
    wr_id: number;
    wr_subject: string;
    wr_name: string;
    mb_id: string;
    wr_good: number;
    wr_datetime: string;
}

interface RatingAggRow {
    cnt: number;
    avg: number | string | null;
}

interface MyRatingRow {
    rating: number;
}

/** mysql2 는 JSON 컬럼을 이미 파싱해 돌려주지만, 문자열로 오는 환경도 방어적으로 처리 */
function parseJson<T>(value: unknown, fallback: T): T {
    if (value == null) return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }
    return value as T;
}

function toEntity(row: EntityRow): AngttEntity {
    return {
        id: row.id,
        type: row.type,
        canonicalTitle: row.canonical_title,
        slug: row.slug,
        aliases: parseJson<string[]>(row.aliases, []),
        posterUrl: row.poster_url || null,
        externalIds: parseJson<Record<string, unknown> | null>(row.external_ids, null),
        meta: parseJson<Record<string, unknown> | null>(row.meta, null),
        releaseDate: row.release_date || null,
        status: row.status,
        ratingCount: Number(row.rating_count ?? 0),
        ratingAvg: Number(row.rating_avg ?? 0),
        reviewPostCount: Number(row.review_post_count ?? 0)
    };
}

const ENTITY_COLUMNS = `id, type, canonical_title, slug, aliases, poster_url, external_ids,
    meta, DATE_FORMAT(release_date, '%Y-%m-%d') AS release_date, status,
    rating_count, rating_avg, review_post_count`;

async function getEntityById(entityId: number): Promise<AngttEntity | null> {
    const [rows] = await pool.query(
        `SELECT ${ENTITY_COLUMNS} FROM angple_entities WHERE id = ? LIMIT 1`,
        [entityId]
    );
    const list = rows as EntityRow[];
    return list[0] ? toEntity(list[0]) : null;
}

/**
 * 작품 슬러그로 작품 행 + 집계를 조회한다. 없으면 null.
 */
export async function getEntityBySlug(slug: string): Promise<AngttEntity | null> {
    const [rows] = await pool.query(
        `SELECT ${ENTITY_COLUMNS} FROM angple_entities WHERE slug = ? LIMIT 1`,
        [slug]
    );
    const list = rows as EntityRow[];
    return list[0] ? toEntity(list[0]) : null;
}

/**
 * 글 태그로 작품을 해석한다.
 *   - 「앙티티」 옵트인 태그가 없으면 → notFound(query: null)
 *   - 「앙티티」 외 태그를 normalize 하여 angple_entity_aliases 정확 일치 조회
 *   - 첫 매칭 별칭의 엔티티 반환. 없으면 notFound(query: 첫 후보 태그 원문)
 */
export async function resolveEntityByTags(tags: string[]): Promise<ResolveEntityResult> {
    if (!hasAngttTag(tags)) return { notFound: true, query: null };

    const angtt = normalizeWorkTitle('앙티티');
    const candidates = tags
        .map((t) => ({ raw: t.trim(), key: normalizeWorkTitle(t) }))
        .filter((c) => c.key && c.key !== angtt);

    if (candidates.length === 0) return { notFound: true, query: null };

    const keys = candidates.map((c) => c.key);
    const [rows] = await pool.query(
        `SELECT alias_norm, entity_id FROM angple_entity_aliases WHERE alias_norm IN (?)`,
        [keys]
    );
    const aliasRows = rows as AliasRow[];
    if (aliasRows.length === 0) return { notFound: true, query: candidates[0].raw };

    // 후보 태그 입력 순서를 존중하여 첫 매칭 별칭을 고른다.
    const aliasMap = new Map<string, number>();
    for (const r of aliasRows) {
        if (typeof r.alias_norm === 'string') aliasMap.set(r.alias_norm, r.entity_id);
    }
    for (const c of candidates) {
        const entityId = aliasMap.get(c.key);
        if (entityId != null) {
            const entity = await getEntityById(entityId);
            if (entity) return { entity };
        }
    }
    return { notFound: true, query: candidates[0].raw };
}

/**
 * 작품에 연결된 커뮤니티 글을 가져온다.
 *
 * angple_entity_posts 에서 (bo_table, wr_id, role) 를 뽑고, 보드별로 그룹핑해
 * 각 g5_write_{board} 를 동적 테이블명으로 조회한다. 삭제글(wr_deleted_at)과
 * 댓글(wr_is_comment<>0)은 제외한다.
 *
 * @param sort  'best' = 추천수(wr_good) 내림차순, 'recent' = 작성일 내림차순
 */
export async function getEntityConnectedPosts(
    entityId: number,
    opts: { sort: 'best' | 'recent'; limit: number }
): Promise<AngttConnectedPost[]> {
    const limit = Math.max(1, Math.min(100, Math.floor(opts.limit)));

    const [linkResult] = await pool.query(
        `SELECT bo_table, wr_id, role FROM angple_entity_posts WHERE entity_id = ?`,
        [entityId]
    );
    const links = linkResult as LinkRow[];
    if (links.length === 0) return [];

    // 보드별 wr_id 그룹핑 + (board, wr_id) → role 맵
    const byBoard = new Map<string, number[]>();
    const roleMap = new Map<string, string>();
    for (const l of links) {
        const safeBoard = String(l.bo_table).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeBoard) continue;
        const wrId = Number(l.wr_id);
        if (!Number.isFinite(wrId)) continue;
        if (!byBoard.has(safeBoard)) byBoard.set(safeBoard, []);
        byBoard.get(safeBoard)!.push(wrId);
        roleMap.set(`${safeBoard}:${wrId}`, l.role);
    }

    const collected: AngttConnectedPost[] = [];
    for (const [board, wrIds] of byBoard) {
        const tableName = `g5_write_${board}`;
        try {
            const [rowResult] = await pool.query(
                `SELECT wr_id, wr_subject, wr_name, mb_id, wr_good,
                        DATE_FORMAT(wr_datetime, '%Y-%m-%d %H:%i:%s') AS wr_datetime
                 FROM ??
                 WHERE wr_id IN (?) AND wr_is_comment = 0 AND wr_deleted_at IS NULL`,
                [tableName, wrIds]
            );
            const rows = rowResult as WriteRow[];
            for (const r of rows) {
                collected.push({
                    boTable: board,
                    wrId: r.wr_id,
                    role: roleMap.get(`${board}:${r.wr_id}`) ?? 'mention',
                    subject: r.wr_subject ?? '',
                    name: r.wr_name ?? '',
                    mbId: r.mb_id ?? '',
                    good: Number(r.wr_good ?? 0),
                    datetime: r.wr_datetime ?? ''
                });
            }
        } catch (e) {
            // 존재하지 않는 보드 테이블 등은 조용히 건너뛴다(연결 데이터가 앞설 수 있음).
            console.warn(`[angtt-review] connected posts skip board=${board}:`, e);
        }
    }

    collected.sort((a, b) => {
        if (opts.sort === 'best' && b.good !== a.good) return b.good - a.good;
        // datetime은 DATE_FORMAT 문자열이지만, 방어적으로 String 강제(과거 Date 객체 500 재발 방지)
        return String(b.datetime).localeCompare(String(a.datetime));
    });

    return collected.slice(0, limit);
}

/**
 * 작품 별점 통합 집계 — 두 경로의 표를 **회원당 1표**로 정규화한 행 집합.
 *
 *  - 작품 별점 (bo_table='@entity') : 작품 페이지에서 직접 남긴 표 → 우선순위 0
 *  - 글 별점  (연결된 글의 표)      : 원글/리뷰 글에서 남긴 표      → 우선순위 1
 *
 * 회원이 작품 페이지와 글 양쪽에 남겼으면 **더 명시적인 작품 별점**을 채택하고,
 * 같은 우선순위 안에서는 최신 표를 채택한다.
 * 한 회원이 같은 작품의 글 5개에 별점을 줘도 작품 점수에는 1표만 반영된다.
 *
 * ⚠️ 이 통합이 없으면 회원이 원글에 남긴 별점이 작품 페이지에서 영원히 보이지 않는다
 *    (실제로 「호프」가 3명 3.33점을 받고도 0.00 으로 표시되던 원인).
 *
 * 파라미터 순서: entityId, ENTITY_RATING_BO_TABLE, entityId, ENTITY_RATING_BO_TABLE
 */
const UNIFIED_RATING_ROWS = `
    SELECT mb_id, rating,
           ROW_NUMBER() OVER (PARTITION BY mb_id ORDER BY pref, updated_at DESC) AS rn
      FROM (
        SELECT mb_id, rating, 0 AS pref, updated_at
          FROM angple_post_ratings
         WHERE entity_id = ? AND bo_table = ?
        UNION ALL
        SELECT pr.mb_id, pr.rating, 1 AS pref, pr.updated_at
          FROM angple_post_ratings pr
          JOIN angple_entity_posts ep
            ON ep.bo_table = pr.bo_table AND ep.wr_id = pr.wr_id
         WHERE ep.entity_id = ? AND pr.bo_table <> ?
      ) u`;

/** UNIFIED_RATING_ROWS 파라미터 묶음 */
const unifiedParams = (entityId: number) => [
    entityId,
    ENTITY_RATING_BO_TABLE,
    entityId,
    ENTITY_RATING_BO_TABLE
];

/**
 * 작품 단위 별점 집계(작품당 회원 1표).
 * 작품 페이지 별점 + 연결된 글의 별점을 회원당 1표로 통합해 읽는다.
 */
export async function getEntityRating(entityId: number, mbId?: string): Promise<AngttEntityRating> {
    const [aggResult] = await pool.query(
        `SELECT COUNT(*) AS cnt, AVG(rating) AS avg
         FROM (${UNIFIED_RATING_ROWS}) x WHERE rn = 1`,
        unifiedParams(entityId)
    );
    const aggRows = aggResult as RatingAggRow[];
    const count = Number(aggRows[0]?.cnt ?? 0);
    const avg = count > 0 ? Number(aggRows[0]?.avg ?? 0) : 0;

    let my: number | null = null;
    if (mbId) {
        const [myResult] = await pool.query(
            `SELECT rating FROM (${UNIFIED_RATING_ROWS}) x
             WHERE rn = 1 AND mb_id = ? LIMIT 1`,
            [...unifiedParams(entityId), mbId]
        );
        const myRows = myResult as MyRatingRow[];
        if (myRows[0]) my = Number(myRows[0].rating);
    }

    return { avg, count, my };
}

/**
 * 작품 단위 별점 등록/수정(회원당 작품당 1표).
 *
 * angple_post_ratings 의 PK(bo_table, wr_id, mb_id) 규약 덕에 UPSERT 한 번으로
 * 첫 투표/재투표가 모두 처리된다(작품 별점은 bo_table='@entity', wr_id=entity_id).
 * 저장 후 angple_entities 의 비정규화 집계(rating_count/rating_avg)를 하위쿼리로
 * 재계산해 작품 페이지·카드의 헤드라인 별점을 최신으로 유지한다.
 *
 * @throws rating 이 1~5 범위 밖이면 에러(호출부에서 400 으로 매핑).
 * @returns 갱신된 집계 + 본인 표({avg, count, my}) — getEntityRating 재사용.
 */
export async function putEntityRating(
    entityId: number,
    mbId: string,
    rating: number
): Promise<AngttEntityRating> {
    const value = Math.round(rating);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
        throw new Error(`invalid rating: ${rating} (must be 1~5)`);
    }

    await pool.query(
        `INSERT INTO angple_post_ratings
            (bo_table, wr_id, mb_id, rating, entity_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = NOW(3)`,
        [ENTITY_RATING_BO_TABLE, entityId, mbId, value, entityId]
    );

    // 비정규화 집계 재계산(작품 페이지/카드 헤드라인 별점 소스)
    // 읽기(getEntityRating)와 **동일한 통합 규칙**을 써야 카드와 상세가 어긋나지 않는다.
    await pool.query(
        `UPDATE angple_entities
         SET rating_count = (
                SELECT COUNT(*) FROM (${UNIFIED_RATING_ROWS}) a WHERE rn = 1
             ),
             rating_avg = (
                SELECT COALESCE(AVG(rating), 0) FROM (${UNIFIED_RATING_ROWS}) b WHERE rn = 1
             )
         WHERE id = ?`,
        [...unifiedParams(entityId), ...unifiedParams(entityId), entityId]
    );

    return getEntityRating(entityId, mbId);
}
