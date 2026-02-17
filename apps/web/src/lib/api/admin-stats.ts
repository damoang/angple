/**
 * 관리자 대시보드 통계 API 클라이언트
 */

export interface DashboardStats {
    totalPosts: number;
    totalMembers: number;
    todayComments: number;
    todayVisitors: number;
    postsChange: number;
    membersChange: number;
    commentsChange: number;
    visitorsChange: number;
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

const API_BASE = '/api/v2/admin';

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
