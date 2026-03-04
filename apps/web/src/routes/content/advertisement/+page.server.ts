import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {
        title: '광고 상품 안내'
    };
};
