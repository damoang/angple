import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getMembership } from '$plugins/ad-free/server/membership-api';

// Shim — 본문은 $plugins/ad-free/server/membership-api.ts
export const GET: RequestHandler = async ({ locals }) => {
    const user = (locals as any).user;
    if (!user?.mb_id) {
        return json({ error: 'unauthorized' }, { status: 401 });
    }
    const membership = await getMembership(user.mb_id, 'default');
    return json(membership);
};
