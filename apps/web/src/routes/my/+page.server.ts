/**
 * 마이페이지 서버 — Streaming SSR + 타임아웃
 *
 * tab/page: 즉시 반환 (URL 파라미터)
 * tabData: 스트리밍 Promise (Go 백엔드, 스켈레톤 → 데이터)
 */
import type { PageServerLoad } from './$types.js';
import type {
    FreePost,
    MyComment,
    BoardStat,
    ExpSummary,
    PaginatedResponse
} from '$lib/api/types.js';
import { env } from '$env/dynamic/private';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

/** Go 백엔드 타임아웃: 5초 */
const BACKEND_TIMEOUT = 5_000;

function parsePaginated<T>(
    json: Record<string, unknown>,
    page: number,
    limit: number
): PaginatedResponse<T> {
    const items = (json.data as T[]) ?? [];
    const meta = json.meta as Record<string, number> | undefined;
    const total = meta?.total ?? 0;
    return {
        items,
        total,
        page: meta?.page ?? page,
        limit: meta?.limit ?? limit,
        total_pages: limit > 0 ? Math.ceil(total / limit) : 0
    };
}

export interface MyPageData {
    expSummary: ExpSummary | null;
    posts: PaginatedResponse<FreePost> | null;
    comments: PaginatedResponse<MyComment> | null;
    likedPosts: PaginatedResponse<FreePost> | null;
    boardStats: BoardStat[] | null;
    error: string | null;
}

/** 탭 데이터 + 경험치 로딩 (타임아웃 포함) */
async function loadMyPageData(
    tab: string,
    page: number,
    limit: number,
    headers: Record<string, string>
): Promise<MyPageData> {
    const result: MyPageData = {
        expSummary: null,
        posts: null,
        comments: null,
        likedPosts: null,
        boardStats: null,
        error: null
    };

    try {
        // expSummary + 탭 데이터 병렬 로딩 (각각 타임아웃)
        const expPromise = fetch(`${BACKEND_URL}/api/v1/my/exp`, {
            headers,
            signal: AbortSignal.timeout(BACKEND_TIMEOUT)
        })
            .then(async (res) => {
                if (!res.ok) return null;
                const json = await res.json();
                return json.data as ExpSummary;
            })
            .catch(() => null);

        let tabPromise: Promise<void>;

        if (tab === 'posts') {
            tabPromise = fetch(`${BACKEND_URL}/api/v1/my/posts?page=${page}&limit=${limit}`, {
                headers,
                signal: AbortSignal.timeout(BACKEND_TIMEOUT)
            }).then(async (res) => {
                if (!res.ok) return;
                result.posts = parsePaginated<FreePost>(await res.json(), page, limit);
            });
        } else if (tab === 'comments') {
            tabPromise = fetch(`${BACKEND_URL}/api/v1/my/comments?page=${page}&limit=${limit}`, {
                headers,
                signal: AbortSignal.timeout(BACKEND_TIMEOUT)
            }).then(async (res) => {
                if (!res.ok) return;
                result.comments = parsePaginated<MyComment>(await res.json(), page, limit);
            });
        } else if (tab === 'liked') {
            tabPromise = fetch(`${BACKEND_URL}/api/v1/my/liked-posts?page=${page}&limit=${limit}`, {
                headers,
                signal: AbortSignal.timeout(BACKEND_TIMEOUT)
            }).then(async (res) => {
                if (!res.ok) return;
                result.likedPosts = parsePaginated<FreePost>(await res.json(), page, limit);
            });
        } else if (tab === 'stats') {
            tabPromise = fetch(`${BACKEND_URL}/api/v1/my/stats`, {
                headers,
                signal: AbortSignal.timeout(BACKEND_TIMEOUT)
            }).then(async (res) => {
                if (!res.ok) return;
                const json = await res.json();
                result.boardStats = (json.data as BoardStat[]) ?? [];
            });
        } else {
            tabPromise = Promise.resolve();
        }

        const [expSummary] = await Promise.all([expPromise, tabPromise]);
        result.expSummary = expSummary;
    } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
        console.error('마이페이지 로딩 에러:', isTimeout ? 'Backend timeout (5s)' : error);
        result.error = isTimeout
            ? '서버 응답이 느립니다. 잠시 후 다시 시도해주세요.'
            : '데이터를 불러오는데 실패했습니다.';
    }

    return result;
}

export const load: PageServerLoad = async ({ url, locals }) => {
    const tab = url.searchParams.get('tab') || 'posts';
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Angple-Web-SSR/1.0'
    };
    if (locals.accessToken) {
        headers['Authorization'] = `Bearer ${locals.accessToken}`;
    }

    // 스트리밍: tabData를 await 하지 않음 → 스켈레톤 먼저 렌더링
    const tabDataPromise = loadMyPageData(tab, page, limit, headers);

    return {
        tab,
        page,
        /** 스트리밍: Promise로 반환 → 클라이언트에서 {#await} 사용 */
        streamed: {
            tabData: tabDataPromise
        }
    };
};
