/**
 * GET /api/angtt/detect?title=...
 *
 * 작성폼 제안 칩 전용 — 제목에서 작품을 감지해 돌려준다 (read-only, 부작용 0).
 * 별칭 사전은 5분 캐시라 히트 시 DB 쿼리 0개, 스캔은 문자열 연산뿐이다.
 *
 * ⛔ 글 상세/목록 등 read 경로에서 이 API 를 호출하지 말 것 — 감지는 쓰기(작성) 문맥
 *    1회로 제한한다는 앙티티 성능 규약. 클라이언트는 제목 입력 debounce 로만 부른다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { detectEntityFromTitle } from '$lib/server/angtt-auto-link';

export const GET: RequestHandler = async ({ url }) => {
    const title = (url.searchParams.get('title') ?? '').slice(0, 200);

    let match = null;
    try {
        match = await detectEntityFromTitle(title);
    } catch (err) {
        // 감지 실패는 기능 저하일 뿐 — 칩만 안 뜨고 작성 흐름엔 영향 없다.
        console.error('[angtt detect] error:', err);
    }

    return json({ match }, { headers: { 'cache-control': 'private, max-age=30' } });
};
