import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getMembership } from '$plugins/ad-free/server/membership-api';

// Shim — 본문은 $plugins/ad-free/server/membership-api.ts
// 회원 식별은 hooks.server.ts 가 채우는 App.Locals.user.id(=mb_id) 기준.
export const GET: RequestHandler = async ({ locals }) => {
    const memberId = locals.user?.id;
    if (!memberId) {
        return json({ error: 'unauthorized' }, { status: 401 });
    }
    const membership = await getMembership(memberId, 'default');
    return json(membership);
};
