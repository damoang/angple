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

    const backendFetch = globalThis.fetch;

    try {
        let posts: PaginatedResponse<FreePost> | null = null;
        let comments: PaginatedResponse<MyComment> | null = null;
        let likedPosts: PaginatedResponse<FreePost> | null = null;
        let boardStats: BoardStat[] | null = null;

        // expSummary + 탭 데이터를 병렬로 로딩
        const expPromise = backendFetch(`${BACKEND_URL}/api/v1/my/exp`, { headers })
            .then(async (res) => {
                if (!res.ok) return null;
                const json = await res.json();
                return json.data as ExpSummary;
            })
            .catch(() => null);

        let tabPromise: Promise<void>;

        if (tab === 'posts') {
            tabPromise = backendFetch(
                `${BACKEND_URL}/api/v1/my/posts?page=${page}&limit=${limit}`,
                { headers }
            ).then(async (res) => {
                if (!res.ok) return;
                posts = parsePaginated<FreePost>(await res.json(), page, limit);
            });
        } else if (tab === 'comments') {
            tabPromise = backendFetch(
                `${BACKEND_URL}/api/v1/my/comments?page=${page}&limit=${limit}`,
                { headers }
            ).then(async (res) => {
                if (!res.ok) return;
                comments = parsePaginated<MyComment>(await res.json(), page, limit);
            });
        } else if (tab === 'liked') {
            tabPromise = backendFetch(
                `${BACKEND_URL}/api/v1/my/liked-posts?page=${page}&limit=${limit}`,
                { headers }
            ).then(async (res) => {
                if (!res.ok) return;
                likedPosts = parsePaginated<FreePost>(await res.json(), page, limit);
            });
        } else if (tab === 'stats') {
            tabPromise = backendFetch(`${BACKEND_URL}/api/v1/my/stats`, { headers }).then(
                async (res) => {
                    if (!res.ok) return;
                    const json = await res.json();
                    boardStats = (json.data as BoardStat[]) ?? [];
                }
            );
        } else {
            tabPromise = Promise.resolve();
        }

        const [expSummary] = await Promise.all([expPromise, tabPromise]);

        return {
            tab,
            page,
            posts,
            comments,
            likedPosts,
            boardStats,
            expSummary,
            error: null as string | null
        };
    } catch (error) {
        console.error('마이페이지 로딩 에러:', error);
        return {
            tab,
            page,
            posts: null as PaginatedResponse<FreePost> | null,
            comments: null as PaginatedResponse<MyComment> | null,
            likedPosts: null as PaginatedResponse<FreePost> | null,
            boardStats: null as BoardStat[] | null,
            expSummary: null as ExpSummary | null,
            error: '데이터를 불러오는데 실패했습니다.'
        };
    }
};
