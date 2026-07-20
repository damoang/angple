/**
 * 앙티티 커넥트 — 작품 사전 서버 모듈 (Phase 1)
 *
 * angtt 게시판 최근 글 목록을 백엔드 API 로 수집해 "정규화 제목 → 작품" 사전을 만든다.
 * celebration.ts 등 $lib/server 인메모리 캐시 관례: TTL 5분 + singleflight(getOrSet)
 * + 실패 시 stale 유지 / 빈 Map fallback.
 *
 * 성능 계약 (페이지 로드 절대 블록 금지):
 * - 모든 백엔드 fetch 는 2s 타임아웃 (member-activity SSR 관례)
 * - 실패는 내부 catch 로 수렴 — resolveAngttMatch 는 reject 하지 않고 undefined 반환
 */
import { backendFetch } from './backend-fetch.js';
import { createCache } from './cache.js';
import pool from './db.js';
import {
    ANGTT_TAG,
    normalizeWorkTitle,
    buildDictionary,
    hasAngttTag,
    matchWorkFromTags,
    type AngttDictionary
} from './angtt-dictionary-logic.js';

export {
    ANGTT_TAG,
    normalizeWorkTitle,
    hasAngttTag,
    buildDictionary,
    matchWorkFromTags
} from './angtt-dictionary-logic.js';
export type { AngttWork, AngttDictionary } from './angtt-dictionary-logic.js';

/** 글 상세 SSR 에 내려가는 카드 데이터 (일치 / 미등록 유도) */
export type AngttMatch =
    | {
          /** angtt 작품 글 번호 — /angtt/{wrId} 링크 대상 */
          wrId: number;
          title: string;
          thumbnail: string;
          /** 별점 집계 — 조회 실패 시 null (카드는 별점 줄만 생략) */
          rating: { avg: number; count: number } | null;
          /**
           * 작품(엔티티) 페이지 슬러그 — 해소 성공 시에만 존재.
           * 있으면 카드 링크가 작품 페이지(/angtt/{slug})로, 없으면 기존 angtt 글(/angtt/{wrId})로 폴백.
           */
          entitySlug?: string;
          /**
           * 이 글의 작품 연결이 **시스템 자동 부착**인지.
           * true 면 카드에 "자동 연결됨 · 해제"를 노출한다 — 조용히 붙이지 않는 것이 원칙이고,
           * 여기서 나오는 해제 신호가 자동 부착 킬 스위치의 입력이 된다.
           */
          autoLinked?: boolean;
      }
    | {
          notFound: true;
          /** 첫 번째 비「앙티티」 태그 — 등록 유도 카드 표기용 */
          query: string;
      };

/** 사전 수집 상한: 최근 500글 (100 x 5페이지) */
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

/** 백엔드 fetch 타임아웃 — SSR 블로킹 방지 (member-activity 관례) */
const FETCH_TIMEOUT_MS = 2_000;

/** 사전 캐시: TTL 5분 */
const DICT_CACHE_KEY = 'angtt-dictionary';
const dictCache = createCache<AngttDictionary>({ ttl: 5 * 60_000, maxSize: 2 });

/** 백엔드 목록 응답의 글 항목 (필요 필드만) */
interface BackendListPost {
    id?: number;
    title?: string;
    thumbnail?: string;
    thumbnail_raw?: string;
    images?: string[];
}

/** 목록 응답 파싱: data 가 배열(index-widgets 관례) 또는 {items} 페이지네이션 둘 다 수용 */
function extractListItems(json: unknown): BackendListPost[] {
    const data = (json as { data?: unknown })?.data;
    if (Array.isArray(data)) return data as BackendListPost[];
    const items = (data as { items?: unknown })?.items;
    if (Array.isArray(items)) return items as BackendListPost[];
    return [];
}

/** angtt 글 목록을 페이지 순회로 수집해 사전 생성. 1페이지 실패는 throw(→stale fallback). */
async function fetchDictionary(): Promise<AngttDictionary> {
    const posts: { wrId: number; title: string; thumbnail: string }[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        try {
            const res = await backendFetch(
                `/api/v1/boards/angtt/posts?page=${page}&limit=${PAGE_LIMIT}`,
                { timeout: FETCH_TIMEOUT_MS }
            );
            if (!res.ok) throw new Error(`angtt list API error: ${res.status}`);

            const items = extractListItems(await res.json());
            for (const item of items) {
                if (!item?.id || !item.title) continue;
                posts.push({
                    wrId: item.id,
                    title: item.title,
                    // 포스터 원본 우선 (poster-gallery 관례) — 컴포넌트에서 toThumbnailUrl 적용
                    thumbnail: item.thumbnail_raw || item.thumbnail || item.images?.[0] || ''
                });
            }
            if (items.length < PAGE_LIMIT) break; // 마지막 페이지
        } catch (err) {
            if (page === 1) throw err; // 전체 실패 → stale/빈 Map fallback 은 호출부에서
            break; // 부분 수집으로 진행
        }
    }

    return buildDictionary(posts);
}

/** 사전 조회 (5분 캐시 + singleflight). 실패 시 stale 유지, 그것도 없으면 빈 Map. */
export async function getAngttDictionary(): Promise<AngttDictionary> {
    try {
        return await dictCache.getOrSet(DICT_CACHE_KEY, fetchDictionary);
    } catch {
        return dictCache.getStale(DICT_CACHE_KEY) ?? new Map();
    }
}

/** 작품 글 별점 집계 조회 (공개 API). 실패 시 null — 카드는 별점 줄만 생략. */
export async function fetchAngttRating(
    wrId: number
): Promise<{ avg: number; count: number } | null> {
    try {
        const res = await backendFetch(`/api/v1/boards/angtt/posts/${wrId}/rating`, {
            timeout: FETCH_TIMEOUT_MS
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { data?: { avg?: number; count?: number } };
        if (typeof json?.data?.avg !== 'number' || typeof json?.data?.count !== 'number') {
            return null;
        }
        return { avg: json.data.avg, count: json.data.count };
    } catch {
        return null;
    }
}

/**
 * 사전 매칭에 실제로 적중한 작품명 태그의 정규화 키를 되찾는다.
 * matchWorkFromTags 와 동일한 후보 추출·입력순 우선 규약을 재현해, 카드가 표시하는
 * 바로 그 작품(wrId)에 대응하는 태그 키를 고른다(엔티티 슬러그 조회 입력).
 */
function findMatchedKey(
    tags: readonly string[],
    dict: AngttDictionary,
    wrId: number
): string | undefined {
    const angtt = normalizeWorkTitle(ANGTT_TAG);
    for (const t of tags) {
        const key = normalizeWorkTitle(t);
        if (!key || key === angtt) continue;
        if (dict.get(key)?.wrId === wrId) return key;
    }
    return undefined;
}

/**
 * 매칭된 작품명(정규화 키)으로 앙티티 작품 페이지 슬러그를 해석한다.
 *
 * angple_entity_aliases.alias_norm(정확 일치, 파라미터 바인딩) → angple_entities.slug
 * (status='active'). 조인은 entity_id(int) 로만 잇는다(문자열 조인 없음 → collation 1267 회피).
 * 미존재/DB 실패는 undefined 로 수렴 — 카드는 기존 /angtt/{wrId} 폴백을 그대로 쓴다.
 */
/**
 * 별칭 → 활성 작품(슬러그 + 작품 별점).
 *
 * 별점을 여기서 함께 읽는 이유: 카드가 보여줘야 하는 것은 **작품 별점**(여러 글에 흩어진
 * 회원 표를 회원당 1표로 통합한 값)이지 특정 angtt 글 하나의 별점이 아니다.
 * rating_count/rating_avg 는 putEntityRating 이 통합 규칙으로 재계산해 두는 비정규화 컬럼이라
 * 여기서는 인덱스 조회 1회로 끝난다(기존 백엔드 HTTP 왕복 제거).
 */
async function resolveEntity(
    matchedKey: string
): Promise<{ slug: string; avg: number; count: number } | undefined> {
    try {
        const [rows] = await pool.query(
            `SELECT e.slug AS slug, e.rating_avg AS avg, e.rating_count AS cnt
             FROM angple_entity_aliases a
             JOIN angple_entities e ON e.id = a.entity_id
             WHERE a.alias_norm = ? AND e.status = 'active'
             LIMIT 1`,
            [matchedKey]
        );
        const list = rows as { slug?: string; avg?: unknown; cnt?: unknown }[];
        const slug = list[0]?.slug;
        if (typeof slug !== 'string' || !slug) return undefined;
        return { slug, avg: Number(list[0]?.avg ?? 0), count: Number(list[0]?.cnt ?? 0) };
    } catch {
        return undefined;
    }
}

/** 이 글의 작품 연결이 시스템 자동 부착(role='auto')인지 — 인덱스 조회 1회 */
async function isAutoLinked(boardId: string, wrId: number): Promise<boolean> {
    try {
        const [rows] = await pool.query(
            `SELECT 1 FROM angple_entity_posts
              WHERE bo_table = ? AND wr_id = ? AND role = 'auto' LIMIT 1`,
            [boardId, wrId]
        );
        return (rows as unknown[]).length > 0;
    } catch {
        return false;
    }
}

/**
 * 글 태그에서 앙티티 카드 데이터를 해석한다.
 *
 * - 「앙티티」 태그 없음 → undefined (필드 자체 미포함)
 * - 「앙티티」 + 사전 일치 태그 → 작품 카드 (+별점, 실패 시 null)
 * - 「앙티티」 + 비일치 태그 → 등록 유도 카드
 * - 「앙티티」 태그만 단독 → undefined
 *
 * 내부 실패는 전부 catch — 절대 reject 하지 않는다.
 */
export async function resolveAngttMatch(
    tags: unknown,
    ctx?: { boardId: string; wrId: number }
): Promise<AngttMatch | undefined> {
    try {
        if (!Array.isArray(tags) || tags.length === 0) return undefined;
        const strTags = tags.filter((t): t is string => typeof t === 'string');
        if (!hasAngttTag(strTags)) return undefined;

        const dict = await getAngttDictionary();
        const match = matchWorkFromTags(strTags, dict);
        if (!match) return undefined;

        if ('work' in match) {
            // 매칭 작품에 활성 엔티티가 있으면 작품 페이지 슬러그 부착(없으면 기존 wrId 폴백).
            const matchedKey = findMatchedKey(strTags, dict, match.work.wrId);
            const entity = matchedKey ? await resolveEntity(matchedKey) : undefined;

            // 별점은 **작품 별점 우선**(회원당 1표 통합값). 엔티티가 없을 때만 기존 글 별점으로 폴백.
            const rating = entity
                ? { avg: entity.avg, count: entity.count }
                : await fetchAngttRating(match.work.wrId);

            // 자동 부착 여부 — 카드에 "자동 연결됨 · 해제"를 노출할지 결정한다.
            const autoLinked = ctx ? await isAutoLinked(ctx.boardId, ctx.wrId) : false;

            return {
                wrId: match.work.wrId,
                title: match.work.title,
                thumbnail: match.work.thumbnail,
                rating,
                ...(entity ? { entitySlug: entity.slug } : {}),
                ...(autoLinked ? { autoLinked: true } : {})
            };
        }
        return { notFound: true, query: match.query };
    } catch {
        return undefined;
    }
}
