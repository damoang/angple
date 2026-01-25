import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ params }) => {
    const memberId = params.id;

    try {
        const profile = await apiClient.getMemberProfile(memberId);

        return {
            profile,
            error: null
        };
    } catch (error) {
        console.error('회원 프로필 로딩 에러:', error);
        return {
            profile: null,
            error: '회원 정보를 불러오는데 실패했습니다.'
        };
    }
};
