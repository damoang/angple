import type { PageServerLoad } from './$types.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, fetch }) => {
    const { productId } = params;

    const res = await fetch(`/api/plugins/commerce/shop/products/${productId}`);
    if (!res.ok) {
        throw error(404, '상품을 찾을 수 없습니다');
    }

    const data = await res.json();
    return {
        product: data.data
    };
};
