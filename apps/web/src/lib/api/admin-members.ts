/**
 * 관리자 회원 관리 API 클라이언트
 */

export interface AdminMember {
    mb_id: string;
    mb_name: string;
    mb_email: string;
    mb_level: number;
    mb_point: number;
    mb_datetime: string;
    mb_today_login?: string;
    mb_image?: string;
    mb_leave_date?: string;
    mb_intercept_date?: string;
    post_count?: number;
    comment_count?: number;
}

export interface MemberListParams {
    page?: number;
    limit?: number;
    search?: string;
    searchField?: 'name' | 'email' | 'id';
    level?: number;
    sortBy?: 'datetime' | 'name' | 'level' | 'point' | 'login';
    sortOrder?: 'asc' | 'desc';
}

export interface MemberListResponse {
    members: AdminMember[];
    total: number;
    page: number;
    limit: number;
}

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

const API_BASE = '/api/v2/admin/members';

export async function listMembers(params: MemberListParams = {}): Promise<MemberListResponse> {
    try {
        const searchParams = new URLSearchParams();
        if (params.page) searchParams.set('page', String(params.page));
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.search) searchParams.set('search', params.search);
        if (params.searchField) searchParams.set('search_field', params.searchField);
        if (params.level !== undefined) searchParams.set('level', String(params.level));
        if (params.sortBy) searchParams.set('sort_by', params.sortBy);
        if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);

        const url = searchParams.toString() ? `${API_BASE}?${searchParams}` : API_BASE;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<MemberListResponse> = await response.json();
        return result.data ?? { members: [], total: 0, page: 1, limit: 20 };
    } catch (error) {
        console.error('❌ 회원 목록 조회 실패:', error);
        throw error;
    }
}

export async function getMember(memberId: string): Promise<AdminMember> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<AdminMember> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 회원 조회 실패:', error);
        throw error;
    }
}

export async function updateMember(
    memberId: string,
    data: { mb_level?: number; mb_point?: number; mb_name?: string }
): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 수정 실패:', error);
        throw error;
    }
}

export async function banMember(memberId: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}/ban`, {
            method: 'POST',
            credentials: 'include'
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 차단 실패:', error);
        throw error;
    }
}

export async function unbanMember(memberId: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}/unban`, {
            method: 'POST',
            credentials: 'include'
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 차단 해제 실패:', error);
        throw error;
    }
}

export async function bulkUpdateLevel(memberIds: string[], level: number): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/bulk/level`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_ids: memberIds, level })
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 일괄 레벨 변경 실패:', error);
        throw error;
    }
}
