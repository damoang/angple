import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {
        title: '다모앙 이용가이드'
    };
};
