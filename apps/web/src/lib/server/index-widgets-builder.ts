/**
 * Go 백엔드가 5분마다 생성하는 index-widgets.json 파일을 직접 읽어서
 * IndexWidgetsData를 반환하는 서버 전용 유틸리티
 *
 * 기존: 9개 게시판 API 병렬 호출 → 변경: 파일 읽기 1회
 */

import { readFile } from 'fs/promises';
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

const JSON_PATH = '/home/damoang/www/data/cache/recommended/index-widgets.json';
const CACHE_TTL_MS = 30_000; // 30초 (파일은 5분마다 갱신)

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
        const json = JSON.parse(raw);

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

/**
 * 단일 게시판 데이터 조회 (post-list 위젯용)
 */
export async function fetchBoardPostsForWidget(
    backendUrl: string,
    boardId: string,
    limit: number
): Promise<BackendPost[]> {
    const response = await fetch(
        `${backendUrl}/api/v1/boards/${boardId}/posts?limit=${limit}&page=1`,
        {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Angple-Web-SSR/1.0'
            }
        }
    );

    if (!response.ok) {
        console.error(`[index-widgets-builder] ${boardId} API error:`, response.status);
        return [];
    }

    const result: BackendBoardResponse = await response.json();
    return result.data ?? [];
}
