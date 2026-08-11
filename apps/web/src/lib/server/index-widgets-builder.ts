/**
 * Go 백엔드가 5분마다 생성하는 index-widgets.json 파일을 직접 읽어서
 * IndexWidgetsData를 반환하는 서버 전용 유틸리티
 *
 * 기존: 9개 게시판 API 병렬 호출 → 변경: 파일 읽기 1회
 */

import { readFile } from 'fs/promises';
import { rewriteImageHosts } from '$lib/server/cdn-rewrite';
import { env } from '$env/dynamic/private';
import { findDisciplinedIds } from '$lib/server/discipline-mask';
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

const EMPTY_RESULT: IndexWidgetsData = {
    news_tabs: [],
    economy_tabs: [],
    gallery: [],
    group_tabs: { all: [], '24h': [], week: [], month: [] },
    emoji_awards: []
};

/** 인메모리 캐시 */
let cachedWidgets: IndexWidgetsData | null = null;
let cacheTimestamp = 0;

/** board+id 를 실은 위젯 글의 최소 형태 */
interface BoardIdItem {
    board?: string;
    id?: number;
}

/**
 * 홈 위젯 목록에서 **이용제한 근거 글**(g5_na_singo.discipline_log_id)을 제거한다.
 *
 * news/economy/gallery/group 탭·emoji_awards 모두 board+id 를 실어 나르고,
 * index-widgets.json 은 5분마다 갱신되는 cron 스냅샷이라 생성 후 신고→징계된 글이
 * 홈 하이라이트로 그대로 노출된다(추천글·공감글·모아보기와 동일 클래스). 마스킹 대신
 * 목록에서 제외한다. 판정 실패 시 로깅만 하고 원본 통과(fail-open).
 *
 * ⚠️ 홈은 최다 트래픽 경로라 필터된 결과를 60초 캐시(스냅샷 자체가 5분 주기라 무해)해
 *    호출당 DB 조회를 파드/분당 1회로 억제한다.
 */
async function filterDisciplinedWidgets(data: IndexWidgetsData): Promise<IndexWidgetsData> {
    const g = data.group_tabs ?? EMPTY_RESULT.group_tabs;
    const groupArrays = [g.all, g['24h'], g.week, g.month];
    const allArrays: BoardIdItem[][] = [
        data.news_tabs,
        data.economy_tabs,
        data.gallery,
        data.emoji_awards as BoardIdItem[],
        ...groupArrays
    ].filter(Boolean) as BoardIdItem[][];

    const byBoard = new Map<string, Set<number>>();
    for (const arr of allArrays) {
        for (const p of arr) {
            if (!p?.board || !p?.id) continue;
            let set = byBoard.get(p.board);
            if (!set) byBoard.set(p.board, (set = new Set()));
            set.add(p.id);
        }
    }
    if (byBoard.size === 0) return data;

    const disciplined = new Map<string, Set<number>>();
    await Promise.all(
        [...byBoard].map(async ([board, ids]) => {
            disciplined.set(board, await findDisciplinedIds(board, [...ids]));
        })
    );
    const isDisc = (p: BoardIdItem) =>
        !!p.board && !!p.id && disciplined.get(p.board)?.has(p.id) === true;
    const keep = <T extends BoardIdItem>(arr: T[] | undefined): T[] =>
        (arr ?? []).filter((p) => !isDisc(p));

    return {
        ...data,
        news_tabs: keep(data.news_tabs),
        economy_tabs: keep(data.economy_tabs),
        gallery: keep(data.gallery),
        group_tabs: {
            all: keep(g.all),
            '24h': keep(g['24h']),
            week: keep(g.week),
            month: keep(g.month)
        },
        emoji_awards: keep(data.emoji_awards as BoardIdItem[]) as IndexWidgetsData['emoji_awards']
    };
}

/**
 * index-widgets.json 파일을 읽어 IndexWidgetsData를 반환 (이용제한 글 제외)
 * 60초 인메모리 캐시로 파일 I/O + 징계 판정 최소화 (스냅샷은 5분 주기)
 */
export async function buildIndexWidgets(_backendUrl: string): Promise<IndexWidgetsData> {
    const now = Date.now();
    if (cachedWidgets && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedWidgets;
    }

    try {
        const raw = await readFile(JSON_PATH, 'utf-8');
        const json = JSON.parse(rewriteImageHosts(raw));

        const rawResult: IndexWidgetsData = {
            news_tabs: (json.news_tabs ?? []) as NewsPost[],
            economy_tabs: (json.economy_tabs ?? []) as EconomyPost[],
            gallery: (json.gallery ?? []) as GalleryPost[],
            group_tabs: (json.group_tabs ?? EMPTY_RESULT.group_tabs) as GroupTabsData,
            emoji_awards: (json.emoji_awards ?? []) as IndexWidgetsData['emoji_awards']
        };

        let result = rawResult;
        try {
            result = await filterDisciplinedWidgets(rawResult);
        } catch (err) {
            console.error('[index-widgets-builder] 징계 필터 실패:', err);
        }

        // 데이터가 있을 때만 캐시 (필터된 결과를 캐시)
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
