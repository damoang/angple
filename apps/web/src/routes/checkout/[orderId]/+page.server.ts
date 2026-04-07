import type { PageServerLoad } from './$types.js';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, fetch, cookies, url }) => {
    const { orderId } = params;

    // 인증 확인
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    // 주문 조회 (프록시 경유)
    const orderRes = await fetch(`/api/commerce/orders/${orderId}`);
    if (!orderRes.ok) {
        throw error(404, '주문을 찾을 수 없습니다');
    }
    const orderData = await orderRes.json();

    // 결제 준비
    const prepareRes = await fetch('/api/commerce/payments/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            order_id: Number(orderId),
            pg_provider: 'tosspayments',
            payment_method: 'card',
            return_url: `${url.origin}/checkout/complete`,
            cancel_url: `${url.origin}/checkout/${orderId}?error=cancelled`
        })
    });

    let paymentData = null;
    if (prepareRes.ok) {
        const res = await prepareRes.json();
        paymentData = res.data;
    }

    return {
        order: orderData.data,
        payment: paymentData
    };
};
