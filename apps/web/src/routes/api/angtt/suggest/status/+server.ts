/**
 * GET /api/angtt/suggest/status?boardId=&wrId=
 *
 * 커넥트 카드의 크라우드 제안 현황 — {suggestions:[{slug,title,count}], myVotes, linked}.
 *
 * ⛔ 글상세 SSR 은 이 데이터를 조회하지 않는다(read 경로 무접촉 원칙).
 *    카드(클라 컴포넌트)가 마운트 후 지연 조회한다. 비로그인은 count 만(myVotes 빈 배열).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSuggestionStatus } from '$plugins/angtt-review/lib/entities.server';

export const GET: RequestHandler = async ({ url, locals, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    const boardId = url.searchParams.get('boardId') ?? '';
    const wrId = Number(url.searchParams.get('wrId') ?? 0);
    if (!/^[a-zA-Z0-9_-]+$/.test(boardId) || !Number.isInteger(wrId) || wrId <= 0) {
        return json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    try {
        const status = await getSuggestionStatus(boardId, wrId, locals.user?.id);
        return json(status);
    } catch (err) {
        // 현황 조회 실패는 기능 저하일 뿐 — 카드는 제안 UI 만 생략한다.
        console.error('[angtt suggest status] error:', err);
        return json({ suggestions: [], myVotes: [], linked: null });
    }
};
