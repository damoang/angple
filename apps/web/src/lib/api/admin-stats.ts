/**
 * 관리자 대시보드 통계 API 클라이언트
 */

/**
 * 관리자 대시보드 통계.
 *
 * ⛔ 2026-08-18: 종전 타입에는 todayVisitors·postsChange·commentsChange·
 * visitorsChange 가 있었으나 **백엔드가 그런 값을 준 적이 없다.**
 * /api/v1/admin/stats 라우트 자체가 없었고, NoRoute 가 200 success:true 를
 * 돌려주는 바람에 실패가 드러나지 않은 채 카드가 "-" 로만 떠 있었다.
 *
 * ⛔ 방문자 수는 넣지 않는다 — g5_visit 테이블이 **완전히 비어 있다**(PHP 시절 기능).
 * 없는 지표를 0 으로 채우면 "방문자 0명"이라는 거짓을 화면이 말하게 된다.
 */
export interface DashboardStats {
    /** g5_member 전체 행 — 탈퇴 회원도 행이 남으므로 포함된다 */
    totalMembers: number;
    /** 탈퇴하지 않은 회원 */
    activeMembers: number;
    leftMembers: number;
    todayJoined: number;
    todayLogin: number;
    /** 최근 7일 가입 수 */
    membersChange: number;
    todayPosts: number;
    todayComments: number;
}

export interface RecentActivity {
    id: number;
    type: 'post' | 'comment' | 'member' | 'report';
    title: string;
    author: string;
    boardId?: string;
    createdAt: string;
}

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

const API_BASE = '/api/v1/admin';

export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const response = await fetch(`${API_BASE}/stats`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<DashboardStats> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 대시보드 통계 조회 실패:', error);
        throw error;
    }
}

export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    try {
        const response = await fetch(`${API_BASE}/activity?limit=${limit}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<RecentActivity[]> = await response.json();
        return result.data ?? [];
    } catch (error) {
        console.error('❌ 최근 활동 조회 실패:', error);
        throw error;
    }
}
