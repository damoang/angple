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
import {
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
 * 글 태그에서 앙티티 카드 데이터를 해석한다.
 *
 * - 「앙티티」 태그 없음 → undefined (필드 자체 미포함)
 * - 「앙티티」 + 사전 일치 태그 → 작품 카드 (+별점, 실패 시 null)
 * - 「앙티티」 + 비일치 태그 → 등록 유도 카드
 * - 「앙티티」 태그만 단독 → undefined
 *
 * 내부 실패는 전부 catch — 절대 reject 하지 않는다.
 */
export async function resolveAngttMatch(tags: unknown): Promise<AngttMatch | undefined> {
    try {
        if (!Array.isArray(tags) || tags.length === 0) return undefined;
        const strTags = tags.filter((t): t is string => typeof t === 'string');
        if (!hasAngttTag(strTags)) return undefined;

        const dict = await getAngttDictionary();
        const match = matchWorkFromTags(strTags, dict);
        if (!match) return undefined;

        if ('work' in match) {
            const rating = await fetchAngttRating(match.work.wrId);
            return {
                wrId: match.work.wrId,
                title: match.work.title,
                thumbnail: match.work.thumbnail,
                rating
            };
        }
        return { notFound: true, query: match.query };
    } catch {
        return undefined;
    }
}
