import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async () => {
    // 클라이언트에서만 인증 체크
    if (browser) {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            throw redirect(302, '/login?redirect=/my/blocked');
        }
    }

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
