/**
 * 조회수 증가 API
 * POST /api/viewcount
 * Body: { boardId: string, postId: number }
 *
 * 쿠키 기반 중복 방지: viewed_posts 쿠키에 최근 100개 글 ID 저장
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { increment } from '$lib/server/viewcount';

const MAX_VIEWED = 100;
const COOKIE_TTL = 60 * 60 * 24; // 24시간

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { boardId, postId } = body;

        if (!boardId || !postId) {
            return json({ success: false, error: 'boardId, postId 필수' }, { status: 400 });
        }

        // boardId 형식 검증 (영문, 숫자, 하이픈, 언더스코어만)
        if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) {
            return json({ success: false, error: '잘못된 boardId' }, { status: 400 });
        }

        const postIdNum = Number(postId);
        if (!Number.isInteger(postIdNum) || postIdNum <= 0) {
            return json({ success: false, error: '잘못된 postId' }, { status: 400 });
        }

        const key = `${boardId}:${postIdNum}`;

        // 쿠키에서 이미 조회한 글 목록 확인
        const viewedRaw = cookies.get('viewed_posts') || '';
        const viewed = viewedRaw ? viewedRaw.split(',').filter(Boolean) : [];

        if (viewed.includes(key)) {
            // 이미 조회한 글 → 카운트 증가하지 않음
            return json({ success: true, counted: false });
        }

        // 조회수 증가
        increment(boardId, postIdNum);

        // 쿠키에 추가 (최대 100개, FIFO)
        viewed.push(key);
        if (viewed.length > MAX_VIEWED) {
            viewed.splice(0, viewed.length - MAX_VIEWED);
        }

        cookies.set('viewed_posts', viewed.join(','), {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: COOKIE_TTL
        });

        return json({ success: true, counted: true });
    } catch {
        return json({ success: false, error: '요청 처리 실패' }, { status: 500 });
    }
};
