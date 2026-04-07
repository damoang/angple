import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { env } from '$env/dynamic/private';

const COMMERCE_API =
    env.DAMOANG_BACKEND_URL || 'http://damoang-backend-svc.damoang.svc.cluster.local:8090';

/** GET /api/trade/reviews?board_id=trade&post_id=123 */
export const GET: RequestHandler = async ({ url }) => {
    const boardId = url.searchParams.get('board_id') || 'trade';
    const postId = url.searchParams.get('post_id');

    if (!postId) {
        return json({ error: 'post_id required' }, { status: 400 });
    }

    try {
        // DB 직접 접근 대신 내부 API 호출 — pool이 없으므로 damoang-backend 경유
        // 하지만 damoang-backend에 trade review API가 없으므로 angple-backend 사용
        const backendUrl = env.BACKEND_URL || 'http://localhost:8081';
        const res = await fetch(
            `${backendUrl}/api/v1/trade/reviews?board_id=${boardId}&post_id=${postId}`
        );

        if (res.ok) {
            const data = await res.json();
            return json(data);
        }

        // fallback: 빈 리뷰
        return json({ reviews: [] });
    } catch {
        return json({ reviews: [] });
    }
};

/** POST /api/trade/reviews */
export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        return json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { board_id, post_id, seller_id, rating, content } = body;

    if (!post_id || !seller_id || !rating || !content) {
        return json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
    }

    try {
        const backendUrl = env.BACKEND_URL || 'http://localhost:8081';
        const res = await fetch(`${backendUrl}/api/v1/trade/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `angple_sid=${sessionCookie}`
            },
            body: JSON.stringify({ board_id, post_id, seller_id, rating, content })
        });

        if (res.ok) {
            const data = await res.json();
            return json(data);
        }

        const err = await res.json().catch(() => ({}));
        return json({ error: err.error || '리뷰 작성 실패' }, { status: res.status });
    } catch {
        return json({ error: '리뷰 작성 실패' }, { status: 500 });
    }
};
