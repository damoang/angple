import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const COMMERCE_API =
    env.DAMOANG_BACKEND_URL || 'http://damoang-backend-svc.damoang.svc.cluster.local:8090';

export const load: PageServerLoad = async ({ cookies, url }) => {
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    const page = Number(url.searchParams.get('page') || '1');
    const res = await fetch(`${COMMERCE_API}/api/plugins/commerce/orders?page=${page}&limit=20`);

    if (!res.ok) {
        return { orders: [], total: 0, page };
    }

    const data = await res.json();
    return {
        orders: data.data?.items || [],
        total: data.data?.total || 0,
        page
    };
};
