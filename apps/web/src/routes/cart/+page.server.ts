import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { isPaymentAvailable } from '$lib/server/payment-availability.js';

export const load: PageServerLoad = async ({ fetch, cookies, locals }) => {
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=/cart`);
    }

    // 결제가 닫혀 있으면 주문 생성도 막아야 한다 (상품 상세와 동일 게이트)
    const paymentAvailable = await isPaymentAvailable(locals);

    try {
        const res = await fetch('/api/commerce/cart');
        if (!res.ok) return { cart: null, paymentAvailable };
        const data = await res.json();
        return { cart: data.data, paymentAvailable };
    } catch {
        return { cart: null, paymentAvailable };
    }
};
