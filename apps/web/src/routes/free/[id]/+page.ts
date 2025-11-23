import { apiClient } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async ({ params }) => {
    try {
        const post = await apiClient.getFreePost(params.id);
        const comments = await apiClient.getFreeComments(params.id);
        return {
            post,
            comments
        };
    } catch (err) {
        console.error('게시글 로딩 에러:', err);
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};
