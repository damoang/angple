import type {
    ApiResponse,
    PaginatedResponse,
    FreePost,
    RegisterApiKeyRequest,
    ApiKeyResponse,
    RefreshTokenRequest,
    ApiError,
    RecommendedDataWithAI,
    RecommendedPeriod,
    FreeComment,
    MenuItem,
    DamoangUser,
    IndexWidgetsData
} from './types.js';
import {
    getMockFreePosts,
    getMockFreePost,
    getMockFreeComments,
    getMockMenus,
    getMockCurrentUser,
    getMockIndexWidgets
} from './mock-data.js';
import { browser } from '$app/environment';

// 서버/클라이언트 환경에 따라 API URL 분기
const API_BASE_URL = browser
    ? import.meta.env.PUBLIC_API_URL || 'https://api.damoang.dev/api/v1'
    : process.env.INTERNAL_API_URL || 'http://localhost:8080/api/v1';

/**
 * API 클라이언트
 *
 * 🔒 보안 기능:
 * - httpOnly cookie를 사용한 Refresh Token 관리 (XSS 공격 방지)
 * - SameSite=Strict 설정으로 CSRF 공격 방지
 * - Access Token은 응답 본문으로 받아 메모리에만 저장
 * - 모든 요청에 credentials: 'include'로 쿠키 자동 전송
 *
 * 📋 인증 플로우:
 * 1. 로그인: Backend가 httpOnly cookie로 Refresh Token 설정
 * 2. API 요청: 쿠키가 자동으로 전송되어 인증
 * 3. 토큰 갱신: /auth/refresh 엔드포인트가 쿠키에서 토큰 읽어 갱신
 * 4. 로그아웃: Backend가 쿠키 만료 처리
 */
class ApiClient {
    private useMock = false; // Mock 모드 플래그

    constructor() {
        // 브라우저 환경에서만 로컬스토리지 접근
        if (typeof window !== 'undefined') {
            // Mock 모드 확인
            const mockSetting = localStorage.getItem('damoang_use_mock');

            // 로컬 개발 환경(localhost)에서는 기본값 true
            // 운영 환경(damoang.dev, damoang.net)에서는 기본값 false
            const isLocalDev =
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

            const isProduction =
                window.location.hostname.includes('damoang.dev') ||
                window.location.hostname.includes('damoang.net');

            if (mockSetting === null || isProduction) {
                // localStorage에 설정이 없거나 운영 환경이면: 로컬은 true, 운영은 false
                this.useMock = isLocalDev && !isProduction;
                localStorage.setItem('damoang_use_mock', this.useMock.toString());
            } else {
                // localStorage 설정 우선 (개발 환경에서만)
                this.useMock = mockSetting !== 'false';
            }
        }
    }

    // Mock 모드 설정
    setMockMode(enabled: boolean): void {
        this.useMock = enabled;
        if (typeof window !== 'undefined') {
            localStorage.setItem('damoang_use_mock', enabled.toString());
        }
    }

    // Mock 모드 상태 확인
    isMockMode(): boolean {
        return this.useMock;
    }

    // HTTP 요청 헬퍼
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const url = `${API_BASE_URL}${endpoint}`;

        // 서버/클라이언트 환경 로깅
        console.log(`[API] ${browser ? 'Client' : 'Server'} → ${url}`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>)
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include' // httpOnly 쿠키 자동 전송
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error((data as ApiError).error || '요청 실패');
            }

            return data as ApiResponse<T>;
        } catch (error) {
            console.error('API 요청 에러:', error);
            throw error;
        }
    }

    // API 키 등록
    // 💡 Backend가 httpOnly cookie로 Refresh Token 자동 설정
    async registerApiKey(request: RegisterApiKeyRequest): Promise<ApiKeyResponse> {
        const response = await this.request<ApiKeyResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        return response.data;
    }

    // 토큰 재발급
    // 💡 쿠키의 Refresh Token으로 자동 갱신, 새 쿠키 발급
    async refreshToken(request: RefreshTokenRequest): Promise<ApiKeyResponse> {
        const response = await this.request<ApiKeyResponse>('/auth/token', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        return response.data;
    }

    // 자유게시판 목록 조회
    async getFreePosts(page = 1, limit = 10): Promise<PaginatedResponse<FreePost>> {
        // Mock 모드일 경우 가짜 데이터 반환
        if (this.useMock) {
            // 실제 API 호출처럼 약간의 지연 추가
            await new Promise((resolve) => setTimeout(resolve, 300));
            return getMockFreePosts(page, limit);
        }

        const response = await this.request<PaginatedResponse<FreePost>>(
            `/free?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    // 자유게시판 상세 조회
    async getFreePost(id: string): Promise<FreePost> {
        // Mock 모드일 경우 가짜 데이터 반환
        if (this.useMock) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return getMockFreePost(id);
        }

        const response = await this.request<FreePost>(`/free/${id}`);
        return response.data;
    }

    // 자유게시판 글 댓글 조회
    async getFreeComments(
        id: string,
        page = 1,
        limit = 10
    ): Promise<PaginatedResponse<FreeComment>> {
        // Mock 모드일 경우 가짜 데이터 반환
        if (this.useMock) {
            // 실제 API 호출처럼 약간의 지연 추가
            await new Promise((resolve) => setTimeout(resolve, 300));
            return getMockFreeComments(page, limit);
        }

        const response = await this.request<PaginatedResponse<FreeComment>>(
            `/free/${id}/comments?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    // 로그아웃
    // 💡 Backend 로그아웃 엔드포인트 호출 → httpOnly cookie 만료 처리
    async logout(): Promise<void> {
        try {
            await this.request('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('로그아웃 에러:', error);
            // 에러가 발생해도 로컬 상태는 정리
        }
    }

    // 추천 글 데이터 가져오기 (AI 분석 포함)
    async getRecommendedPostsWithAI(period: RecommendedPeriod): Promise<RecommendedDataWithAI> {
        // Mock 모드: static 폴더에서 JSON 직접 로드
        if (this.useMock) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            // period 매핑: 1h → 1hour, 3h → 3hours 등
            const periodMap: Record<RecommendedPeriod, string> = {
                '1h': '1hour',
                '3h': '3hours',
                '6h': '6hours',
                '12h': '12hours',
                '24h': '24hours',
                '48h': '48hours'
            };
            const fileName = periodMap[period] || period;
            // static/data/cache/recommended/ai_1hour.json 형식으로 저장됨
            const response = await fetch(`/data/cache/recommended/ai_${fileName}.json`);
            if (!response.ok) {
                throw new Error(`AI 추천 글 데이터 로드 실패: ${period}`);
            }
            return await response.json();
        }

        // 실제 API 모드 (나중에 구현)
        const response = await this.request<RecommendedDataWithAI>(`/recommended/ai/${period}`);
        return response.data;
    }

    // 사이드바 메뉴 조회
    async getMenus(): Promise<MenuItem[]> {
        // Mock 모드일 경우 가짜 데이터 반환
        if (this.useMock) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return getMockMenus();
        }

        const response = await this.request<MenuItem[]>('/menus/sidebar');
        return response.data;
    }

    // 현재 로그인 사용자 조회
    async getCurrentUser(): Promise<DamoangUser | null> {
        // Mock 모드일 경우 가짜 데이터 반환
        if (this.useMock) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return getMockCurrentUser();
        }

        try {
            const response = await this.request<DamoangUser>('/auth/me');
            return response.data;
        } catch {
            // 비로그인 상태는 에러가 아니므로 null 반환
            console.log('User not logged in');
            return null;
        }
    }

    // 인덱스 위젯 데이터 조회
    async getIndexWidgets(): Promise<IndexWidgetsData> {
        // Mock 모드일 경우 가짜 데이터 반환
        if (this.useMock) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return getMockIndexWidgets();
        }

        const response = await this.request<IndexWidgetsData>('/recommended/index-widgets');
        return response.data;
    }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();
