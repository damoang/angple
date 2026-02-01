import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async () => {
    try {
        const blockedMembers = await apiClient.getBlockedMembers();

        return {
            blockedMembers,
            error: null
        };
    } catch (error) {
        console.error('차단 목록 로딩 에러:', error);
        return {
            blockedMembers: [],
            error: '차단 목록을 불러오는데 실패했습니다.'
        };
    }
};
