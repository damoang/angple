import type { PageLoad } from './$types.js';
import { apiClient } from '$lib/api/index.js';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

/**
 * 글쓰기 페이지 데이터 로드
 * 게시판 정보 (카테고리 목록 등)를 가져옴
 */
export const load: PageLoad = async ({ params }) => {
    const { boardId } = params;

    try {
        const board = await apiClient.getBoard(boardId);

        // 카테고리 목록 파싱
        const categories = board.category_list
            ? board.category_list.split('|').filter((c) => c.trim())
            : [];

        return {
            boardId,
            board,
            categories
        };
    } catch (error) {
        console.error('Failed to load board info:', boardId, error);
        return {
            boardId,
            board: null,
            categories: []
        };
    }
};
