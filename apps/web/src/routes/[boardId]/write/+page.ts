import type { PageLoad } from './$types.js';
import { apiClient } from '$lib/api/index.js';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

/** 글쓰기 권한 조회 결과 */
export interface WritePermission {
    can_write: boolean;
    remaining: number; // -1 = 무제한
    daily_limit: number; // 0 = 무제한
    reason?: string;
}

/**
 * 글쓰기 페이지 데이터 로드
 * 게시판 정보 (카테고리 목록 등) + 글쓰기 권한 조회
 */
export const load: PageLoad = async ({ params, fetch }) => {
    const { boardId } = params;

    try {
        const board = await apiClient.getBoard(boardId);

        // 카테고리 목록 파싱
        const categories = board.category_list
            ? board.category_list.split('|').filter((c) => c.trim())
            : [];

        // 글쓰기 권한 조회 (인증 토큰은 fetch에서 자동 전달)
        let writePermission: WritePermission | null = null;
        try {
            const permRes = await fetch(`/api/v1/boards/${boardId}/write-permission`);
            if (permRes.ok) {
                const permData = await permRes.json();
                writePermission = permData.data as WritePermission;
            }
        } catch {
            // 권한 조회 실패 시 무시 (서버에서 재검증)
        }

        return {
            boardId,
            board,
            categories,
            writePermission
        };
    } catch (error) {
        console.error('Failed to load board info:', boardId, error);
        return {
            boardId,
            board: null,
            categories: [],
            writePermission: null
        };
    }
};
