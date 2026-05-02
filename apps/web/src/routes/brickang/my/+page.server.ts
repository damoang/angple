import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }
    const userId = Number(locals.user.id ?? 0) || 0;
    return { userId };
};
