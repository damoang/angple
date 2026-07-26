/**
 * 관리자 회원 관리 API 클라이언트
 */

export interface AdminMember {
    mb_id: string;
    mb_name: string;
    mb_real_name: string;
    mb_email: string;
    mb_level: number;
    mb_point: number;
    mb_signature: string;
    mb_memo: string;
    mb_datetime: string;
    mb_today_login?: string;
    mb_image?: string;
    mb_leave_date?: string;
    mb_leave_reason?: string;
    mb_intercept_date?: string;
    post_count?: number;
    comment_count?: number;
    /** 실명인증 상태. 빈 문자열이면 미인증. (simple=간편인증, abroad=해외/수동, ipin, hp) */
    mb_certify?: string;
    /** 명의 중복 검사(DI) 보유 여부. 수동 인증은 DI 를 만들지 않아 인증돼도 false 일 수 있다. */
    has_dupinfo?: boolean;
}

export interface AnonymizeMemberInput {
    replacementNickname?: string;
    targets: string[];
    searchTexts?: string[];
}

export interface AnonymizeMemberResult {
    member_id: number;
    username: string;
    replacement_nickname: string;
    search_texts: string[];
    resolved_targets: Array<{
        url: string;
        board_id: string;
        post_id: number;
        comment_id?: number;
    }>;
    updated_rows: Array<{
        table: string;
        row_id: string;
        reason: string;
    }>;
    skipped_rows: Array<{
        table: string;
        row_id: string;
        reason: string;
    }>;
    backup_file: string;
    manifest_file: string;
}

export interface MemberListParams {
    page?: number;
    limit?: number;
    search?: string;
    searchField?: 'name' | 'email' | 'id';
    level?: number;
    sortBy?: 'datetime' | 'name' | 'level' | 'point' | 'login';
    sortOrder?: 'asc' | 'desc';
    status?: 'active' | 'banned' | 'left';
    dateFrom?: string;
    dateTo?: string;
    pointMin?: number;
    pointMax?: number;
    loginFrom?: string;
    loginTo?: string;
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

import { safeJson } from './safe-json.js';

const API_BASE = '/api/v1/admin/members';

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
        if (params.status) searchParams.set('status', params.status);
        if (params.dateFrom) searchParams.set('date_from', params.dateFrom);
        if (params.dateTo) searchParams.set('date_to', params.dateTo);
        if (params.pointMin !== undefined) searchParams.set('point_min', String(params.pointMin));
        if (params.pointMax !== undefined) searchParams.set('point_max', String(params.pointMax));
        if (params.loginFrom) searchParams.set('login_from', params.loginFrom);
        if (params.loginTo) searchParams.set('login_to', params.loginTo);

        const url = searchParams.toString() ? `${API_BASE}?${searchParams}` : API_BASE;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<MemberListResponse> = await safeJson(response);
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
        const result: APIResponse<AdminMember> = await safeJson(response);
        return result.data;
    } catch (error) {
        console.error('❌ 회원 조회 실패:', error);
        throw error;
    }
}

export async function updateMember(
    memberId: string,
    data: {
        mb_level?: number;
        mb_point?: number;
        mb_name?: string;
        mb_real_name?: string;
        mb_email?: string;
        mb_signature?: string;
        mb_memo?: string;
        mb_leave?: boolean;
        mb_leave_reason?: string;
    }
): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
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
            const errorResult = await safeJson(response);
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
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 차단 해제 실패:', error);
        throw error;
    }
}

/**
 * 회원 수동 실명인증 / 해제
 *
 * 해외 앙님처럼 국내 휴대폰 인증이 불가능한 회원을 관리자가 직접 처리한다.
 *
 * ⛔ 수동 인증은 DI(명의 중복 검사)를 만들지 않는다. 인증 회원 권한(인증필수 게시판·
 *    쪽지 발송·자동 등급 승급)이 열리므로 사유가 반드시 남아야 한다(서버가 10자 이상 강제).
 */
export async function certifyMember(
    memberId: string,
    certify: boolean,
    reason: string
): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}/certify`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ certify, reason })
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 인증 처리 실패:', error);
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
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 일괄 레벨 변경 실패:', error);
        throw error;
    }
}

export async function anonymizeMemberByUsername(
    username: string,
    input: AnonymizeMemberInput
): Promise<AnonymizeMemberResult> {
    try {
        const response = await fetch(
            `/api/v2/admin/members/by-username/${encodeURIComponent(username)}/anonymize`,
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    replacement_nickname: input.replacementNickname?.trim() || undefined,
                    targets: input.targets,
                    search_texts: input.searchTexts?.filter((value) => value.trim().length > 0)
                })
            }
        );
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<AnonymizeMemberResult> = await safeJson(response);
        return result.data;
    } catch (error) {
        console.error('❌ 회원 익명화 실패:', error);
        throw error;
    }
}

// ========================================
// 관리자 회원 메모 (Admin Member Memo)
// ========================================

export interface MemberMemo {
    id: number;
    member_id: string;
    target_member_id: string;
    memo: string;
    memo_detail?: string;
    color: string;
    created_at: string;
    updated_at?: string;
}

export async function getMemberMemos(memberId: string): Promise<MemberMemo[]> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}/memos`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<MemberMemo[]> = await safeJson(response);
        return result.data ?? [];
    } catch (error) {
        console.error('❌ 회원 메모 조회 실패:', error);
        return [];
    }
}

export async function createMemberMemo(
    memberId: string,
    data: { memo: string; memo_detail?: string; color?: string }
): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${memberId}/memos`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 메모 작성 실패:', error);
        throw error;
    }
}

export async function updateMemberMemo(
    memoId: number,
    data: { memo?: string; memo_detail?: string; color?: string }
): Promise<void> {
    try {
        const response = await fetch(`/api/v1/admin/memos/${memoId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 메모 수정 실패:', error);
        throw error;
    }
}

export async function deleteMemberMemo(memoId: number): Promise<void> {
    try {
        const response = await fetch(`/api/v1/admin/memos/${memoId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 회원 메모 삭제 실패:', error);
        throw error;
    }
}

export async function getBulkMemberMemos(
    memberIds: string[]
): Promise<Record<string, { memo: string; color: string }>> {
    if (memberIds.length === 0) return {};
    try {
        const response = await fetch(
            `/api/v1/admin/members/memos/bulk?member_ids=${memberIds.join(',')}`,
            { credentials: 'include' }
        );
        if (!response.ok) return {};
        const result: APIResponse<Record<string, { memo: string; color: string }>> =
            await safeJson(response);
        return result.data ?? {};
    } catch {
        return {};
    }
}
