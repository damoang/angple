import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

/** /my/settings → /member/settings 리다이렉트 */
export const load: PageServerLoad = async () => {
    redirect(302, '/member/settings');
};
