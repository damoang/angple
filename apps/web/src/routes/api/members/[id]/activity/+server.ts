/**
 * 작성자 활동 API — Go 백엔드 프록시
 * GET /api/members/[id]/activity?limit=5
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { backendFetch } from '$lib/server/backend-fetch';
import { isWithdrawnMember } from '../_withdrawn';
import { maskActivityEmails } from '$lib/server/member-activity';

const EMPTY_RESPONSE = { recentPosts: [], recentComments: [] };

export const GET: RequestHandler = async ({ params, url }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_-]+$/.test(memberId)) {
        return json(EMPTY_RESPONSE, { status: 400 });
    }

    const limit = url.searchParams.get('limit') || '5';

    // 탈퇴 회원 활동 비노출 — Go GetMemberActivity 에는 탈퇴 가드가 없어 프록시 전 차단
    if (await isWithdrawnMember(memberId)) {
        return json(EMPTY_RESPONSE);
    }

    try {
        const res = await backendFetch(
            `/api/v1/members/${encodeURIComponent(memberId)}/activity?limit=${limit}`
        );
        const data = await res.json();
        return json(data && typeof data === 'object' ? maskActivityEmails(data) : data);
    } catch {
        return json(EMPTY_RESPONSE);
    }
};
