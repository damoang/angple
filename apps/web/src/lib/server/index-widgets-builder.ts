/**
 * Go 백엔드가 5분마다 생성하는 index-widgets.json 파일을 직접 읽어서
 * IndexWidgetsData를 반환하는 서버 전용 유틸리티
 *
 * 기존: 9개 게시판 API 병렬 호출 → 변경: 파일 읽기 1회
 */

import { readFile } from 'fs/promises';
import { env } from '$env/dynamic/private';
import type {
    IndexWidgetsData,
    NewsPost,
    EconomyPost,
    GalleryPost,
    GroupTabsData
} from '$lib/api/types';

/** 백엔드 게시글 응답 타입 (fetchBoardPostsForWidget 용) */
interface BackendPost {
    id: number;
    title: string;
    author: string;
    author_id: string;
    created_at: string;
    views: number;
    likes: number;
    dislikes?: number;
    comments_count: number;
    has_file?: boolean;
    thumbnail?: string;
    category?: string;
    content?: string;
}

interface BackendBoardResponse {
    data: BackendPost[];
    meta: {
        board_id: string;
        page: number;
        limit: number;
        total: number;
    };
}

const JSON_PATH =
    env.INDEX_WIDGETS_CACHE_PATH ||
    '/home/damoang/legacy-data/data/cache/recommended/index-widgets.json';
const CACHE_TTL_MS = 60_000; // 60초 (파일은 5분마다 갱신)

/**
 * 이미지 read CDN base (CDN_URL). Go 생성기가 index-widgets.json 의 thumbnail/content 를
 * s3/cdn.damoang.net 으로 박아 보내는데, 이 위젯 경로는 normalizeMediaUrl 을 거치지 않아
 * 홈에서만 s3 URL 이 노출됨 (게시판 목록은 정규화됨). 여기서 raw 단계에 host 를 치환한다.
 * multi-tenant: 테넌트별 CDN_URL env 사용. 미설정(기본 s3) 시 no-op.
 */
const CDN_BASE = (env.CDN_URL || 'https://s3.damoang.net').replace(/\/$/, '');

/** index-widgets.json 의 /data/ 이미지 host 를 CDN_BASE 로 치환 (R2 read cutover). */
function rewriteImageHosts(rawJson: string): string {
    if (CDN_BASE === 'https://s3.damoang.net') return rawJson; // 기본값 = 치환 불필요
    return rawJson.replace(/https:\/\/(?:s3|cdn)\.damoang\.net\/data\//g, `${CDN_BASE}/data/`);
}

const EMPTY_RESULT: IndexWidgetsData = {
    news_tabs: [],
    economy_tabs: [],
    gallery: [],
    group_tabs: { all: [], '24h': [], week: [], month: [] }
};

/** 인메모리 캐시 */
let cachedWidgets: IndexWidgetsData | null = null;
let cacheTimestamp = 0;

/**
 * index-widgets.json 파일을 읽어 IndexWidgetsData를 반환
 * 30초 인메모리 캐시로 파일 I/O 최소화
 */
export async function buildIndexWidgets(_backendUrl: string): Promise<IndexWidgetsData> {
    const now = Date.now();
    if (cachedWidgets && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedWidgets;
    }

    try {
        const raw = await readFile(JSON_PATH, 'utf-8');
        const json = JSON.parse(rewriteImageHosts(raw));

        const result: IndexWidgetsData = {
            news_tabs: (json.news_tabs ?? []) as NewsPost[],
            economy_tabs: (json.economy_tabs ?? []) as EconomyPost[],
            gallery: (json.gallery ?? []) as GalleryPost[],
            group_tabs: (json.group_tabs ?? EMPTY_RESULT.group_tabs) as GroupTabsData
        };

        // 데이터가 있을 때만 캐시
        if (
            result.news_tabs.length > 0 ||
            result.economy_tabs.length > 0 ||
            result.gallery.length > 0
        ) {
            cachedWidgets = result;
            cacheTimestamp = now;
        }

        return result;
    } catch (err) {
        console.error('[index-widgets-builder] JSON 파일 읽기 실패:', err);
        // stale 캐시라도 반환
        if (cachedWidgets) return cachedWidgets;
        return EMPTY_RESULT;
    }
}

/** 홈 SSR 위젯 백엔드 fetch timeout — 빠르게 fail-fast 해야 홈이 깨지지 않음 */
const WIDGET_FETCH_TIMEOUT_MS = 3000;

/**
 * 단일 게시판 데이터 조회 (post-list 위젯용)
 *
 * 백엔드 hang 시 3s 후 AbortSignal 로 강제 중단 → SSR pending closure heap retain 방지.
 * 실패 시 빈 배열 fallback — 홈 페이지가 한 위젯 때문에 깨지지 않도록.
 */
export async function fetchBoardPostsForWidget(
    backendUrl: string,
    boardId: string,
    limit: number
): Promise<BackendPost[]> {
    try {
        const response = await fetch(
            `${backendUrl}/api/v1/boards/${boardId}/posts?limit=${limit}&page=1`,
            {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Angple-Web-SSR/1.0'
                },
                signal: AbortSignal.timeout(WIDGET_FETCH_TIMEOUT_MS)
            }
        );

        if (!response.ok) {
            console.error('[index-widgets-builder]', boardId, 'API error:', response.status);
            return [];
        }

        const result: BackendBoardResponse = await response.json();
        return result.data ?? [];
    } catch (err) {
        // timeout 또는 network 에러 — 홈이 깨지지 않도록 빈 결과 fallback
        const isTimeout =
            err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
        console.error(
            '[index-widgets-builder]',
            boardId,
            isTimeout ? 'fetch timeout' : 'fetch failed:',
            err
        );
        return [];
    }
}
