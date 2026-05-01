import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const MUZIA_HOSTS = new Set(['muzia.net', 'www.muzia.net', 'muzia.io', 'www.muzia.io', 'localhost', '127.0.0.1']);

export const load: LayoutServerLoad = async ({ url }) => {
    if (!MUZIA_HOSTS.has(url.hostname)) {
        throw redirect(302, '/');
    }
    return {};
};
