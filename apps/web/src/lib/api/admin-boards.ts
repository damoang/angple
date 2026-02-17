/**
 * 관리자 게시판 관리 API 클라이언트
 */

import type { Board, BoardGroup } from '$lib/api/types';

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

const API_BASE = '/api/v2/admin/boards';

export interface CreateBoardRequest {
    board_id: string;
    group_id: string;
    subject: string;
    board_type?: string;
    skin?: string;
    mobile_skin?: string;
    page_rows?: number;
    list_level?: number;
    read_level?: number;
    write_level?: number;
    reply_level?: number;
    comment_level?: number;
    use_category?: number;
    category_list?: string;
    use_good?: number;
    use_nogood?: number;
    upload_count?: number;
    upload_size?: number;
}

export interface UpdateBoardRequest {
    group_id?: string;
    subject?: string;
    board_type?: string;
    skin?: string;
    mobile_skin?: string;
    page_rows?: number;
    list_level?: number;
    read_level?: number;
    write_level?: number;
    reply_level?: number;
    comment_level?: number;
    use_category?: number;
    category_list?: string;
    use_good?: number;
    use_nogood?: number;
    upload_count?: number;
    upload_size?: number;
}

export async function listBoards(): Promise<Board[]> {
    try {
        const response = await fetch(API_BASE, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<Board[]> = await response.json();
        return result.data ?? [];
    } catch (error) {
        console.error('❌ 게시판 목록 조회 실패:', error);
        throw error;
    }
}

export async function getBoard(boardId: string): Promise<Board> {
    try {
        const response = await fetch(`${API_BASE}/${boardId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<Board> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 게시판 조회 실패:', error);
        throw error;
    }
}

export async function createBoard(request: CreateBoardRequest): Promise<Board> {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<Board> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 게시판 생성 실패:', error);
        throw error;
    }
}

export async function updateBoard(boardId: string, request: UpdateBoardRequest): Promise<Board> {
    try {
        const response = await fetch(`${API_BASE}/${boardId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<Board> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 게시판 수정 실패:', error);
        throw error;
    }
}

export async function deleteBoard(boardId: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${boardId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 게시판 삭제 실패:', error);
        throw error;
    }
}

export async function listBoardGroups(): Promise<BoardGroup[]> {
    try {
        const response = await fetch('/api/board-groups', {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.data ?? data ?? [];
    } catch (error) {
        console.error('❌ 게시판 그룹 조회 실패:', error);
        return [];
    }
}
