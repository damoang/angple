import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=/member/escrow`);
    }

    try {
        const res = await fetch('/api/commerce/escrow/transactions');
        if (!res.ok) return { transactions: [] };
        const data = await res.json();
        return { transactions: data.data?.items ?? data.data ?? [] };
    } catch {
        return { transactions: [] };
    }
};
