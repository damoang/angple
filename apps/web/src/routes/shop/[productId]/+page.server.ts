import type { PageServerLoad } from './$types.js';
import { error } from '@sveltejs/kit';
import { isPaymentAvailable } from '$lib/server/payment-availability.js';

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
    const { productId } = params;

    const res = await fetch(`/api/plugins/commerce/shop/products/${productId}`);
    if (!res.ok) {
        throw error(404, '상품을 찾을 수 없습니다');
    }

    const data = await res.json();
    return {
        product: data.data,
        // 활성 PG 설정이 있을 때만 결제 가능. 하드코딩 없이 DB 설정으로 열고 닫는다.
        paymentAvailable: await isPaymentAvailable(locals)
    };
};
