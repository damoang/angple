import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { apiClient } from '$lib/api/index.js';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ url }) => {
    // 클라이언트에서만 인증 체크
    if (browser) {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            throw redirect(302, '/login?redirect=/my');
        }
    }

    const tab = url.searchParams.get('tab') || 'posts';
    const page = Number(url.searchParams.get('page')) || 1;

    try {
        // 탭에 따라 다른 데이터 로드
        let posts = null;
        let comments = null;
        let likedPosts = null;

        if (tab === 'posts') {
            posts = await apiClient.getMyPosts(page, 20);
        } else if (tab === 'comments') {
            comments = await apiClient.getMyComments(page, 20);
        } else if (tab === 'liked') {
            likedPosts = await apiClient.getMyLikedPosts(page, 20);
        }

        return {
            tab,
            page,
            posts,
            comments,
            likedPosts,
            error: null
        };
    } catch (error) {
        console.error('마이페이지 로딩 에러:', error);
        return {
            tab,
            page,
            posts: null,
            comments: null,
            likedPosts: null,
            error: '데이터를 불러오는데 실패했습니다.'
        };
    }
};
