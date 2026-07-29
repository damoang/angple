import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * 관리자 전용 API 가드.
 *
 * 통과하면 null, 막으면 403 Response 를 돌려준다. 호출부는 이렇게 쓴다:
 *
 *   const denied = requireAdmin(locals);
 *   if (denied) return denied;
 *
 * 왜 있는가 (2026-07-29):
 *   `/api/admin` 하위 11개 라우트 중 4개에 인증 코드가 한 줄도 없었다.
 *   `GET /api/admin/settings` 는 익명으로 200 을 돌려줬고 oauth clientSecret 필드가
 *   응답에 들어 있었다. PUT 은 누구나 사이트 설정을 덮어쓸 수 있었다.
 *   나머지 라우트들은 각자 같은 조건문을 손으로 적고 있었는데, 손으로 적는 방식은
 *   "새로 만들 때 빠뜨리면 뚫린다". 실제로 그렇게 4개가 빠졌다.
 *
 *   hooks.server.ts 에 경로 접두사 가드를 두어 1차로 막고, 이 헬퍼로 라우트마다
 *   한 번 더 막는다. 훅이 리팩터링으로 사라져도 라우트가 버틴다.
 *
 * ⛔ mb_level 10 = 관리자. as_level(XP 레벨)과 절대 혼동하지 말 것 —
 *    as_level 은 활동량 표시용이라 권한 판정에 쓰면 누구나 관리자가 된다.
 */
export function requireAdmin(locals: RequestEvent['locals']): Response | null {
    if (!locals.user || locals.user.level < 10) {
        return json(
            { success: false, error: 'Unauthorized' },
            { status: 403, headers: { 'cache-control': 'private, no-store' } }
        );
    }
    return null;
}
