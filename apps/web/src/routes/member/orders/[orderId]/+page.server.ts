import type { PageServerLoad } from './$types.js';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
    const sessionCookie = cookies.get('angple_sid') || cookies.get('access_token');
    if (!sessionCookie) {
        throw redirect(302, `/login?redirect=/member/orders/${params.orderId}`);
    }

    const res = await fetch(`/api/commerce/orders/${params.orderId}`);
    if (!res.ok) {
        throw error(404, '주문을 찾을 수 없습니다');
    }
    const data = await res.json();

    // 배송 추적 정보 (있으면)
    let tracking = null;
    try {
        const trackRes = await fetch(`/api/commerce/orders/${params.orderId}/tracking`);
        if (trackRes.ok) {
            const trackData = await trackRes.json();
            tracking = trackData.data;
        }
    } catch {
        /* ignore */
    }

    return {
        order: data.data,
        tracking
    };
};
