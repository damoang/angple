import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=/cart`);
    }

    try {
        const res = await fetch('/api/commerce/cart');
        if (!res.ok) return { cart: null };
        const data = await res.json();
        return { cart: data.data };
    } catch {
        return { cart: null };
    }
};
