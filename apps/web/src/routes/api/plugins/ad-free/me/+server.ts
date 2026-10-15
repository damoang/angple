import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getMembership } from '$plugins/ad-free/server/membership-api';

// Shim — 본문은 $plugins/ad-free/server/membership-api.ts
export const GET: RequestHandler = async ({ locals }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- App.Locals.user 타입에 mb_id 가 선언되어 있지 않다
    const user = (locals as any).user;
    if (!user?.mb_id) {
        return json({ error: 'unauthorized' }, { status: 401 });
    }
    const membership = await getMembership(user.mb_id, 'default');
    return json(membership);
};
