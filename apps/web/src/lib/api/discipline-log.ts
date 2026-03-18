/**
 * Discipline Log (이용제한 기록) API
 */
import { browser } from '$app/environment';
import { safeJson } from './safe-json.js';

const API_BASE = browser ? '/api/v1' : 'http://localhost:8090/api/v1';

// Violation Types (from disciplinelog.inc.php)
export const VIOLATION_TYPES: Record<number, { title: string; desc: string }> = {
    // 기본 위반 유형 (1-18)
    1: { title: '회원비하', desc: '회원을 비난하거나 비하하는 행위' },
    2: { title: '예의없음', desc: '반말 등 예의를 갖추지 않은 행위' },
    3: { title: '부적절한 표현', desc: '욕설, 비속어, 혐오표현 등 부적절한 표현을 사용하는 행위' },
    4: { title: '차별행위', desc: '지역, 세대, 성, 인종 등 특정한 집단에 대한 차별행위' },
    5: { title: '분란유도/갈등조장', desc: '분란을 유도하거나 갈등을 조장하는 행위' },
    6: { title: '여론조성', desc: '특정한 목적을 숨기고 여론을 조성하는 행위' },
    7: { title: '회원기만', desc: '회원을 기만하는 행위' },
    8: { title: '이용방해', desc: '회원의 서비스 이용을 방해하는 행위' },
    9: { title: '용도위반', desc: '게시판의 용도를 위반하는 행위' },
    10: { title: '거래금지위반', desc: '회사의 허락 없이 게시판을 통해 물품/금전을 거래하는 행위' },
    11: { title: '구걸', desc: '금전을 요구하거나 금전의 지급을 유도하는 행위' },
    12: { title: '권리침해', desc: '타인의 권리를 침해하는 행위' },
    13: { title: '외설', desc: '지나치게 외설적인 표현물을 공유하는 행위' },
    14: { title: '위법행위', desc: '불법정보, 불법촬영물을 공유하는 등 현행법에 위배되는 행위' },
    15: { title: '광고/홍보', desc: '회사의 허락 없이 광고나 홍보하는 행위' },
    16: { title: '운영정책부정', desc: '운영진/운영정책을 근거 없이 반복적으로 부정하는 행위' },
    17: { title: '다중이', desc: '다중계정 또는 징계회피목적으로 재가입하는 행위' },
    18: { title: '기타사유', desc: '기타 전항 각호에 준하는 사유' },
    // 확장 위반 유형 (21-38: 1-18과 동일)
    21: { title: '회원비하', desc: '회원을 비난하거나 비하하는 행위' },
    22: { title: '예의없음', desc: '반말 등 예의를 갖추지 않은 행위' },
    23: { title: '부적절한 표현', desc: '욕설, 비속어, 혐오표현 등 부적절한 표현을 사용하는 행위' },
    24: { title: '차별행위', desc: '지역, 세대, 성, 인종 등 특정한 집단에 대한 차별행위' },
    25: { title: '분란유도/갈등조장', desc: '분란을 유도하거나 갈등을 조장하는 행위' },
    26: { title: '여론조성', desc: '특정한 목적을 숨기고 여론을 조성하는 행위' },
    27: { title: '회원기만', desc: '회원을 기만하는 행위' },
    28: { title: '이용방해', desc: '회원의 서비스 이용을 방해하는 행위' },
    29: { title: '용도위반', desc: '게시판의 용도를 위반하는 행위' },
    30: { title: '거래금지위반', desc: '회사의 허락 없이 게시판을 통해 물품/금전을 거래하는 행위' },
    31: { title: '구걸', desc: '금전을 요구하거나 금전의 지급을 유도하는 행위' },
    32: { title: '권리침해', desc: '타인의 권리를 침해하는 행위' },
    33: { title: '외설', desc: '지나치게 외설적인 표현물을 공유하는 행위' },
    34: { title: '위법행위', desc: '불법정보, 불법촬영물을 공유하는 등 현행법에 위배되는 행위' },
    35: { title: '광고/홍보', desc: '회사의 허락 없이 광고나 홍보하는 행위' },
    36: { title: '운영정책부정', desc: '운영진/운영정책을 근거 없이 반복적으로 부정하는 행위' },
    37: { title: '다중이', desc: '다중계정 또는 징계회피목적으로 재가입하는 행위' },
    38: { title: '기타사유', desc: '기타 전항 각호에 준하는 사유' },
    // 추가 유형 (39-40)
    39: { title: '뉴스펌글누락', desc: '뉴스 펌글 작성 시 필수 사항(스크린샷, 출처, 의견) 누락' },
    40: { title: '뉴스전문전재', desc: '뉴스 전문을 허가 없이 전재하는 행위' }
};

export interface ReportedItem {
    table: string; // board_id (legacy: "table" field from PHP)
    id: number; // post_id
    parent?: number; // comment parent (legacy: "parent" field)
}

export interface ViolationType {
    code: number;
    title: string;
    description: string;
}

export interface DisciplineLogListItem {
    id: number;
    member_id: string;
    member_nickname: string;
    penalty_period: number; // -1: permanent, 0: warning, >0: days
    penalty_date_from: string;
    penalty_date_to?: string;
    violation_types: number[];
    violation_titles: string[];
    memo?: string;
}

export interface DisciplineLogDetail {
    id: number;
    member_id: string;
    member_nickname: string;
    penalty_period: number;
    penalty_date_from: string;
    penalty_date_to?: string;
    violation_types: ViolationType[];
    reported_items?: ReportedItem[];
    memo?: string;
    created_by: string;
    created_at: string;
    status: 'pending' | 'approved' | 'rejected';
    claim_post_id?: number;
}

export interface DisciplineLogListResponse {
    success: boolean;
    data: DisciplineLogListItem[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

export interface DisciplineLogDetailResponse {
    success: boolean;
    data: DisciplineLogDetail;
}

/**
 * Get penalty period display text and color
 */
export function getPenaltyDisplay(
    period: number,
    penaltyDateTo?: string
): {
    text: string;
    color: 'magenta' | 'orange' | 'red' | 'green';
    released: boolean;
} {
    // 경고는 해제 개념 없음
    if (period === 0) {
        return { text: '주의', color: 'orange', released: false };
    }
    // 영구 제재는 해제되지 않음
    if (period === -1) {
        return { text: '영구', color: 'magenta', released: false };
    }
    // 기간은 항상 원래 값 표시, released 플래그로 해제 여부 구분
    let released = false;
    if (penaltyDateTo) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const toDate = new Date(penaltyDateTo);
        toDate.setHours(0, 0, 0, 0);
        if (toDate < today) {
            released = true;
        }
    }
    return { text: `${period}일`, color: released ? 'green' : 'red', released };
}

/**
 * Get violation type title by code
 */
export function getViolationTitle(code: number): string {
    return VIOLATION_TYPES[code]?.title || `미정의(${code})`;
}

/**
 * Fetch discipline log list
 */
export async function getDisciplineLogs(
    page = 1,
    limit = 20,
    memberId?: string
): Promise<DisciplineLogListResponse> {
    let url = `${API_BASE}/discipline-logs?page=${page}&limit=${limit}`;
    if (memberId) {
        url += `&member_id=${encodeURIComponent(memberId)}`;
    }
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return safeJson(response);
}

/**
 * Fetch discipline log detail
 */
export async function getDisciplineLog(id: number): Promise<DisciplineLogDetailResponse> {
    const url = `${API_BASE}/discipline-logs/${id}`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return safeJson(response);
}

/**
 * Create discipline log (admin only)
 */
export interface CreateDisciplineLogRequest {
    member_id: string;
    member_nickname: string;
    penalty_period: number;
    penalty_date_from: string;
    violation_types: number[];
    reported_items?: ReportedItem[];
}

export async function createDisciplineLog(
    req: CreateDisciplineLogRequest
): Promise<DisciplineLogDetailResponse> {
    const url = `${API_BASE}/admin/discipline-logs`;
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return safeJson(response);
}

/**
 * Approve discipline log (admin only)
 */
export async function approveDisciplineLog(id: number): Promise<void> {
    const url = `${API_BASE}/admin/discipline-logs/${id}/approve`;
    const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

/**
 * Reject discipline log (admin only)
 */
export async function rejectDisciplineLog(id: number): Promise<void> {
    const url = `${API_BASE}/admin/discipline-logs/${id}/reject`;
    const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}
