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
    FreeComment
} from './types.js';
import { getMockFreePosts, getMockFreePost, getMockFreeComments } from './mock-data.js';

const API_BASE_URL = 'https://api.ang.dev/api/v1';

/**
 * API 클라이언트
 *
 * ⚠️ 보안 경고:
 * 현재 accessToken을 localStorage에 저장하고 있어 XSS 공격에 취약합니다.
 *
 * 🔒 권장 보안 개선 사항:
 * 1. refreshToken → httpOnly cookie (서버에서만 접근)
 * 2. accessToken → 메모리 저장 (페이지 로드 시마다 refreshToken으로 재발급)
 * 3. CSRF 보호를 위한 SameSite=Strict 설정
 *
 * 📋 개선 계획:
 * - Phase 1: Mock 데이터로 UI/UX 개발 (현재 단계)
 * - Phase 2: 백엔드 인증 API 개선 (httpOnly cookie 지원)
 * - Phase 3: 프론트엔드 토큰 관리 리팩토링
 *
 * @see https://github.com/playonly23/angple/issues/XX (보안 이슈 링크)
 */
class ApiClient {
    private token: string | null = null;
    private tokenExpiry: Date | null = null;
    private useMock = false; // Mock 모드 플래그

    constructor() {
        // 브라우저 환경에서만 로컬스토리지 접근
        if (typeof window !== 'undefined') {
            this.loadToken();
            // Mock 모드 확인: 로컬스토리지에 명시적 설정이 없으면 기본값 true (개발 편의성)
            const mockSetting = localStorage.getItem('damoang_use_mock');
            this.useMock = mockSetting !== 'false'; // 'false'가 아니면 true (기본값)
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

    // 로컬스토리지에서 토큰 로드
    // ⚠️ TODO: httpOnly cookie로 마이그레이션 필요
    private loadToken(): void {
        const savedToken = localStorage.getItem('damoang_api_token');
        const savedExpiry = localStorage.getItem('damoang_api_token_expiry');

        if (savedToken && savedExpiry) {
            const expiryDate = new Date(savedExpiry);
            if (expiryDate > new Date()) {
                this.token = savedToken;
                this.tokenExpiry = expiryDate;
            } else {
                this.clearToken();
            }
        }
    }

    // 토큰 저장
    // ⚠️ SECURITY: localStorage는 XSS 공격에 취약합니다.
    // TODO: 백엔드에서 httpOnly cookie 지원 후 제거 예정
    private saveToken(token: string, expiresAt: string): void {
        this.token = token;
        this.tokenExpiry = new Date(expiresAt);

        if (typeof window !== 'undefined') {
            localStorage.setItem('damoang_api_token', token);
            localStorage.setItem('damoang_api_token_expiry', expiresAt);
        }
    }

    // 토큰 삭제
    private clearToken(): void {
        this.token = null;
        this.tokenExpiry = null;

        if (typeof window !== 'undefined') {
            localStorage.removeItem('damoang_api_token');
            localStorage.removeItem('damoang_api_token_expiry');
        }
    }

    // 토큰 유효성 검사
    private isTokenValid(): boolean {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }
        return this.tokenExpiry > new Date();
    }

    // HTTP 요청 헬퍼
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>)
        };

        // 인증 토큰 추가
        if (this.token && this.isTokenValid()) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
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
    async registerApiKey(request: RegisterApiKeyRequest): Promise<ApiKeyResponse> {
        const response = await this.request<ApiKeyResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        if (response.success && response.data) {
            this.saveToken(response.data.token, response.data.expires_at);
        }

        return response.data;
    }

    // 토큰 재발급
    async refreshToken(request: RefreshTokenRequest): Promise<ApiKeyResponse> {
        const response = await this.request<ApiKeyResponse>('/auth/token', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        if (response.success && response.data) {
            this.saveToken(response.data.token, response.data.expires_at);
        }

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
    async getFreeComments(id: string, page = 1, limit = 10): Promise<PaginatedResponse<FreeComment>> {
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

    // 토큰 상태 확인
    getTokenStatus(): { hasToken: boolean; isValid: boolean; expiresAt: Date | null } {
        return {
            hasToken: !!this.token,
            isValid: this.isTokenValid(),
            expiresAt: this.tokenExpiry
        };
    }

    // 수동 토큰 설정
    setToken(token: string, expiresAt: string): void {
        this.saveToken(token, expiresAt);
    }

    // 로그아웃
    logout(): void {
        this.clearToken();
    }

    // 추천 글 데이터 가져오기 (AI 분석 포함)
    async getRecommendedPostsWithAI(
        period: RecommendedPeriod
    ): Promise<RecommendedDataWithAI> {
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
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();
