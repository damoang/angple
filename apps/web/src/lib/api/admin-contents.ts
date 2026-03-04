/**
 * 관리자 정적 페이지(콘텐츠) 관리 API 클라이언트
 */

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

const API_BASE = '/api/v2/admin/contents';

export interface ContentListItem {
    co_id: string;
    co_subject: string;
    co_seo_title: string;
    co_level: number;
    co_hit: number;
    co_html: number;
}

export interface ContentDetail {
    co_id: string;
    co_subject: string;
    co_content: string;
    co_mobile_content: string;
    co_html: number;
    co_seo_title: string;
    co_level: number;
    co_hit: number;
    co_skin: string;
    co_mobile_skin: string;
    co_tag_filter_use: number;
    co_include_head: string;
    co_include_tail: string;
    co_href_content: string;
    created_at: string;
    updated_at: string;
}

export interface UpdateContentRequest {
    co_subject?: string;
    co_content?: string;
    co_mobile_content?: string;
    co_html?: number;
    co_seo_title?: string;
    co_level?: number;
    co_href_content?: string;
}

export async function listContents(): Promise<ContentListItem[]> {
    try {
        const response = await fetch(API_BASE, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<ContentListItem[]> = await response.json();
        return result.data ?? [];
    } catch (error) {
        console.error('콘텐츠 목록 조회 실패:', error);
        throw error;
    }
}

export async function getContent(coId: string): Promise<ContentDetail> {
    try {
        const response = await fetch(`${API_BASE}/${coId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<ContentDetail> = await response.json();
        return result.data;
    } catch (error) {
        console.error('콘텐츠 조회 실패:', error);
        throw error;
    }
}

export async function updateContent(
    coId: string,
    request: UpdateContentRequest
): Promise<ContentDetail> {
    try {
        const response = await fetch(`${API_BASE}/${coId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<ContentDetail> = await response.json();
        return result.data;
    } catch (error) {
        console.error('콘텐츠 수정 실패:', error);
        throw error;
    }
}
