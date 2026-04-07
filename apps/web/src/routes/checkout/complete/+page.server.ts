import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
    // 인증 확인
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    const paymentKey = url.searchParams.get('paymentKey');
    const orderId = url.searchParams.get('orderId');
    const amount = url.searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
        return { success: false, error: '결제 정보가 올바르지 않습니다.' };
    }

    // 결제 승인 요청
    try {
        const res = await fetch('/api/commerce/payments/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pg_provider: 'tosspayments',
                pg_tid: paymentKey,
                pg_order_id: orderId,
                amount: Number(amount)
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return {
                success: false,
                error: err.message || '결제 승인에 실패했습니다.'
            };
        }

        const data = await res.json();
        return {
            success: true,
            payment: data.data
        };
    } catch {
        return {
            success: false,
            error: '결제 처리 중 오류가 발생했습니다.'
        };
    }
};
