import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {
        title: '온사이트 광고 운영정책'
    };
};
