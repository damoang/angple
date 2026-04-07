import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ fetch, url }) => {
    const page = Number(url.searchParams.get('page') || '1');
    const limit = 20;

    const res = await fetch(`/api/plugins/commerce/shop/products?page=${page}&limit=${limit}`);
    if (!res.ok) {
        return { products: [], total: 0, page, limit };
    }

    const data = await res.json();
    return {
        products: data.data?.items || [],
        total: data.data?.total || 0,
        page,
        limit
    };
};
