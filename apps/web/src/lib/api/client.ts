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
    IndexWidgetsData,
    CreatePostRequest,
    UpdatePostRequest,
    CreateCommentRequest,
    UpdateCommentRequest,
    Board,
    LikeResponse,
    LikersResponse,
    SearchParams,
    GlobalSearchResponse,
    MemberProfile,
    MyActivity,
    BlockedMember,
    UploadedFile,
    PresignedUrlResponse,
    PostAttachment,
    CreateReportRequest,
    PointSummary,
    PointHistoryResponse,
    NotificationSummary,
    NotificationListResponse,
    MessageKind,
    MessageListResponse,
    Message,
    SendMessageRequest,
    ExpSummary,
    ExpHistoryResponse,
    LoginRequest,
    LoginResponse,
    OAuthProvider,
    OAuthLoginRequest,
    RegisterRequest,
    RegisterResponse
} from './types.js';
import { browser } from '$app/environment';

// 서버/클라이언트 환경에 따라 API URL 분기
const API_BASE_URL = browser
    ? import.meta.env.VITE_API_URL || '/api/v2'
    : import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v2';

// 디버깅: API URL 확인
console.log('[API Client] Browser:', browser);
console.log('[API Client] VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('[API Client] Final API_BASE_URL:', API_BASE_URL);

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
    // 토큰 갱신 중복 방지
    private refreshPromise: Promise<string | null> | null = null;

    // 액세스 토큰 가져오기 헬퍼
    private getAccessToken(): string | null {
        if (!browser) return null;

        // 1. localStorage에서 먼저 확인
        let accessToken = localStorage.getItem('access_token');

        // 2. localStorage에 없으면 쿠키에서 damoang_jwt 확인
        if (!accessToken) {
            const jwtCookie = document.cookie
                .split('; ')
                .find((row) => row.startsWith('damoang_jwt='));
            if (jwtCookie) {
                accessToken = jwtCookie.split('=')[1];
            }
        }

        return accessToken;
    }

    // 토큰 갱신 (중복 요청 방지)
    private async refreshAccessToken(): Promise<string | null> {
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = (async () => {
            try {
                console.log('[API] Refreshing access token...');
                const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include' // refresh_token httpOnly 쿠키 전송
                });

                if (!response.ok) {
                    console.warn('[API] Token refresh failed:', response.status);
                    return null;
                }

                const data = await response.json();
                const newToken = data?.data?.access_token || data?.access_token;
                if (newToken && browser) {
                    localStorage.setItem('access_token', newToken);
                    console.log('[API] Access token refreshed successfully');
                }
                return newToken || null;
            } catch (err) {
                console.error('[API] Token refresh error:', err);
                return null;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    // 자동 갱신 제외 대상
    private static NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/logout', '/auth/refresh', '/auth/register'];

    // HTTP 요청 실행
    private async doFetch<T>(endpoint: string, options: RequestInit = {}): Promise<{ response: Response; data?: any }> {
        const url = `${API_BASE_URL}${endpoint}`;

        console.log(`[API] ${browser ? 'Client' : 'Server'} → ${url}`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>)
        };

        const accessToken = this.getAccessToken();
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });

        console.log(`[API] Response status:`, response.status, response.statusText);

        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { response };
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                const data = await response.json();
                console.log(`[API] Response data:`, JSON.stringify(data).substring(0, 200));
                return { response, data };
            } catch (parseError) {
                console.error('[API] JSON 파싱 에러:', parseError);
                throw new Error('서버 응답을 처리할 수 없습니다.');
            }
        }

        return { response };
    }

    // HTTP 요청 헬퍼 (401 시 자동 토큰 갱신)
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        try {
            let { response, data } = await this.doFetch<T>(endpoint, options);

            // 401이고 refresh 가능한 엔드포인트면 토큰 갱신 후 재시도
            if (response.status === 401 && browser && !ApiClient.NO_REFRESH_ENDPOINTS.some(e => endpoint.startsWith(e))) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    // 갱신된 토큰으로 원래 요청 재시도
                    const retryResult = await this.doFetch<T>(endpoint, options);
                    response = retryResult.response;
                    data = retryResult.data;
                }
            }

            // 204 / 빈 응답
            if (response.status === 204 || (!data && response.ok)) {
                return { data: undefined as T } as ApiResponse<T>;
            }

            // JSON 아닌 응답
            if (data === undefined) {
                if (!response.ok) throw new Error(`서버 에러 (${response.status})`);
                return { data: undefined as T } as ApiResponse<T>;
            }

            if (!response.ok) {
                console.error(`[API] Error response:`, data);
                const apiErr = (data as ApiError).error;
                const errMsg = typeof apiErr === 'string' ? apiErr : (apiErr as any)?.message || '요청 실패';
                throw new Error(errMsg);
            }

            return data as ApiResponse<T>;
        } catch (error) {
            console.error('[API] 요청 에러:', error);
            throw error;
        }
    }

    // API 키 등록
    async registerApiKey(request: RegisterApiKeyRequest): Promise<ApiKeyResponse> {
        const response = await this.request<ApiKeyResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        return response.data;
    }

    // 토큰 재발급
    async refreshToken(request: RefreshTokenRequest): Promise<ApiKeyResponse> {
        const response = await this.request<ApiKeyResponse>('/auth/token', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        return response.data;
    }

    // 게시판 공지사항 조회
    async getBoardNotices(boardId: string): Promise<FreePost[]> {
        interface BackendResponse {
            data: FreePost[];
        }

        try {
            const response = await this.request<BackendResponse>(`/boards/${boardId}/notices`);

            const backendData = response as unknown as BackendResponse;
            return backendData.data || [];
        } catch (error) {
            // 공지사항 API가 없거나 에러 시 빈 배열 반환
            console.warn('[API] 공지사항 로드 실패:', boardId, error);
            return [];
        }
    }

    // ========================================
    // 동적 게시판 조회 (범용)
    // ========================================

    /**
     * 게시판 글 목록 조회 (동적 boardId)
     */
    async getBoardPosts(
        boardId: string,
        page = 1,
        limit = 10
    ): Promise<PaginatedResponse<FreePost>> {
        interface BackendResponse {
            data: FreePost[];
            meta: {
                board_id: string;
                page: number;
                limit: number;
                total: number;
            };
        }

        const response = await this.request<BackendResponse>(
            `/boards/${boardId}/posts?page=${page}&limit=${limit}`
        );

        const backendData = response as unknown as BackendResponse;

        const result: PaginatedResponse<FreePost> = {
            items: backendData.data || [],
            total: backendData.meta?.total || 0,
            page: backendData.meta?.page || page,
            limit: backendData.meta?.limit || limit,
            total_pages: backendData.meta
                ? Math.ceil(backendData.meta.total / backendData.meta.limit)
                : 0
        };

        return result;
    }

    /**
     * 게시글 상세 조회 (동적 boardId)
     */
    async getBoardPost(boardId: string, postId: string): Promise<FreePost> {
        interface BackendPostResponse {
            data: FreePost;
        }

        const response = await this.request<BackendPostResponse>(
            `/boards/${boardId}/posts/${postId}`
        );
        const backendData = response as unknown as BackendPostResponse;

        return backendData.data;
    }

    /**
     * 게시글 댓글 조회 (동적 boardId)
     */
    async getBoardComments(
        boardId: string,
        postId: string,
        page = 1,
        limit = 10
    ): Promise<PaginatedResponse<FreeComment>> {
        interface BackendCommentsResponse {
            data: FreeComment[];
        }

        const response = await this.request<BackendCommentsResponse>(
            `/boards/${boardId}/posts/${postId}/comments?page=${page}&limit=${limit}`
        );

        const backendData = response as unknown as BackendCommentsResponse;

        const result: PaginatedResponse<FreeComment> = {
            items: backendData.data || [],
            total: backendData.data?.length || 0,
            page: page,
            limit: limit,
            total_pages: 1
        };

        return result;
    }

    // ========================================
    // 자유게시판 조회 (하위 호환성 유지)
    // ========================================

    // 자유게시판 목록 조회
    async getFreePosts(page = 1, limit = 10): Promise<PaginatedResponse<FreePost>> {
        return this.getBoardPosts('free', page, limit);
    }

    // 자유게시판 상세 조회
    async getFreePost(id: string): Promise<FreePost> {
        return this.getBoardPost('free', id);
    }

    // 자유게시판 글 댓글 조회
    async getFreeComments(
        id: string,
        page = 1,
        limit = 10
    ): Promise<PaginatedResponse<FreeComment>> {
        return this.getBoardComments('free', id, page, limit);
    }

    // 게시판 정보 조회
    async getBoard(boardId: string): Promise<Board> {
        interface BackendBoardResponse {
            data: Board;
        }

        const response = await this.request<BackendBoardResponse>(`/boards/${boardId}`);

        console.log('[API] Board detail raw response:', response);

        const backendData = response as unknown as BackendBoardResponse;

        return backendData.data;
    }

    // 로그아웃
    async logout(): Promise<void> {
        try {
            await this.request('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('로그아웃 에러:', error);
        }
    }

    // 추천 글 데이터 가져오기 (AI 분석 포함)
    async getRecommendedPostsWithAI(period: RecommendedPeriod): Promise<RecommendedDataWithAI> {
        const response = await this.request<RecommendedDataWithAI>(`/recommended/ai/${period}`);
        return response.data;
    }

    // 사이드바 메뉴 조회
    async getMenus(): Promise<MenuItem[]> {
        const response = await this.request<MenuItem[]>('/menus/sidebar');
        return response.data;
    }

    // 현재 로그인 사용자 조회
    // /auth/profile은 JWT 기반, /auth/me는 쿠키 기반
    async getCurrentUser(): Promise<DamoangUser | null> {
        try {
            // JWT Authorization 헤더 기반 인증
            interface ProfileResponse {
                user_id: string;
                nickname: string;
                level: number;
            }
            const response = await this.request<ProfileResponse>('/auth/profile');
            if (!response.data) {
                return null;
            }
            // /auth/profile 응답을 DamoangUser 형식으로 변환
            return {
                mb_id: response.data.user_id,
                mb_name: response.data.nickname,
                mb_level: response.data.level,
                mb_email: '' // profile API는 email을 반환하지 않음
            };
        } catch {
            console.log('User not logged in');
            return null;
        }
    }

    // 인덱스 위젯 데이터 조회
    async getIndexWidgets(): Promise<IndexWidgetsData> {
        const response = await this.request<IndexWidgetsData>('/recommended/index-widgets');
        return response.data;
    }

    // ========================================
    // 게시글 CRUD (Create, Update, Delete)
    // ========================================

    /**
     * 게시글 작성
     * 🔒 인증 필요: Authorization 헤더에 Access Token 필요
     */
    async createPost(boardId: string, request: CreatePostRequest): Promise<FreePost> {
        const response = await this.request<FreePost>(`/boards/${boardId}/posts`, {
            method: 'POST',
            body: JSON.stringify(request)
        });

        return response.data;
    }

    /**
     * 게시글 수정
     * 🔒 인증 필요 + 작성자 본인만 가능
     */
    async updatePost(
        boardId: string,
        postId: string,
        request: UpdatePostRequest
    ): Promise<FreePost> {
        const response = await this.request<FreePost>(`/boards/${boardId}/posts/${postId}`, {
            method: 'PUT',
            body: JSON.stringify(request)
        });

        return response.data;
    }

    /**
     * 게시글 삭제
     * 🔒 인증 필요 + 작성자 본인만 가능
     */
    async deletePost(boardId: string, postId: string): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}`, {
            method: 'DELETE'
        });
    }

    // ========================================
    // 댓글 CRUD (Create, Update, Delete)
    // ========================================

    /**
     * 댓글 작성
     * 🔒 인증 필요
     */
    async createComment(
        boardId: string,
        postId: string,
        request: CreateCommentRequest
    ): Promise<FreeComment> {
        const response = await this.request<FreeComment>(
            `/boards/${boardId}/posts/${postId}/comments`,
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        );

        return response.data;
    }

    /**
     * 댓글 수정
     * 🔒 인증 필요 + 작성자 본인만 가능
     */
    async updateComment(
        boardId: string,
        postId: string,
        commentId: string,
        request: UpdateCommentRequest
    ): Promise<FreeComment> {
        const response = await this.request<FreeComment>(
            `/boards/${boardId}/posts/${postId}/comments/${commentId}`,
            {
                method: 'PUT',
                body: JSON.stringify(request)
            }
        );

        return response.data;
    }

    /**
     * 댓글 삭제
     * 🔒 인증 필요 + 작성자 본인만 가능
     */
    async deleteComment(boardId: string, postId: string, commentId: string): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE'
        });
    }

    // ========================================
    // 추천/비추천 (Like/Dislike)
    // ========================================

    /**
     * 게시글 추천
     * 🔒 인증 필요
     */
    async likePost(boardId: string, postId: string): Promise<LikeResponse> {
        const response = await this.request<LikeResponse>(
            `/boards/${boardId}/posts/${postId}/like`,
            { method: 'POST' }
        );
        return response.data;
    }

    /**
     * 게시글 비추천
     * 🔒 인증 필요
     */
    async dislikePost(boardId: string, postId: string): Promise<LikeResponse> {
        const response = await this.request<LikeResponse>(
            `/boards/${boardId}/posts/${postId}/dislike`,
            { method: 'POST' }
        );
        return response.data;
    }

    /**
     * 게시글 추천 상태 조회
     */
    async getPostLikeStatus(boardId: string, postId: string): Promise<LikeResponse> {
        const response = await this.request<LikeResponse>(
            `/boards/${boardId}/posts/${postId}/like-status`
        );
        return response.data;
    }

    /**
     * 게시글 추천자 목록 조회
     */
    async getPostLikers(
        boardId: string,
        postId: string,
        page = 1,
        limit = 20
    ): Promise<LikersResponse> {
        const response = await this.request<LikersResponse>(
            `/boards/${boardId}/posts/${postId}/likers?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    /**
     * 댓글 추천
     * 🔒 인증 필요
     */
    async likeComment(boardId: string, postId: string, commentId: string): Promise<LikeResponse> {
        const response = await this.request<LikeResponse>(
            `/boards/${boardId}/posts/${postId}/comments/${commentId}/like`,
            { method: 'POST' }
        );
        return response.data;
    }

    /**
     * 댓글 비추천
     * 🔒 인증 필요
     */
    async dislikeComment(
        boardId: string,
        postId: string,
        commentId: string
    ): Promise<LikeResponse> {
        const response = await this.request<LikeResponse>(
            `/boards/${boardId}/posts/${postId}/comments/${commentId}/dislike`,
            { method: 'POST' }
        );
        return response.data;
    }

    // ========================================
    // 검색 (Search)
    // ========================================

    /**
     * 게시판 내 검색
     * @param boardId 게시판 ID
     * @param params 검색 파라미터 (query, field, page, limit)
     */
    async searchPosts(boardId: string, params: SearchParams): Promise<PaginatedResponse<FreePost>> {
        interface BackendResponse {
            data: FreePost[];
            meta: {
                board_id: string;
                page: number;
                limit: number;
                total: number;
            };
        }

        const queryParams = new URLSearchParams({
            sfl: params.field,
            stx: params.query,
            page: String(params.page || 1),
            limit: String(params.limit || 20)
        });

        const response = await this.request<BackendResponse>(
            `/boards/${boardId}/posts?${queryParams.toString()}`
        );

        const backendData = response as unknown as BackendResponse;

        return {
            items: backendData.data,
            total: backendData.meta.total,
            page: backendData.meta.page,
            limit: backendData.meta.limit,
            total_pages: Math.ceil(backendData.meta.total / backendData.meta.limit)
        };
    }

    /**
     * 전체 검색 (모든 게시판)
     * @param query 검색어
     * @param field 검색 필드
     * @param limit 게시판당 결과 개수 (기본 5개)
     */
    async searchGlobal(
        query: string,
        field: SearchParams['field'] = 'title_content',
        limit = 5
    ): Promise<GlobalSearchResponse> {
        const queryParams = new URLSearchParams({
            q: query,
            sfl: field,
            limit: String(limit)
        });

        const response = await this.request<GlobalSearchResponse>(
            `/search?${queryParams.toString()}`
        );

        return response.data;
    }

    // ========================================
    // 회원 (Member)
    // ========================================

    /**
     * 회원 프로필 조회
     * @param memberId 회원 ID
     */
    async getMemberProfile(memberId: string): Promise<MemberProfile> {
        const response = await this.request<MemberProfile>(`/members/${memberId}`);
        return response.data;
    }

    /**
     * 내 활동 내역 조회 (마이페이지)
     * 🔒 인증 필요
     */
    async getMyActivity(): Promise<MyActivity> {
        const response = await this.request<MyActivity>('/my/activity');
        return response.data;
    }

    /**
     * 내가 쓴 글 목록
     * 🔒 인증 필요
     */
    async getMyPosts(page = 1, limit = 20): Promise<PaginatedResponse<FreePost>> {
        interface BackendResponse {
            data: FreePost[];
            meta: { page: number; limit: number; total: number };
        }

        const response = await this.request<BackendResponse>(
            `/my/posts?page=${page}&limit=${limit}`
        );

        const backendData = response as unknown as BackendResponse;

        return {
            items: backendData.data,
            total: backendData.meta.total,
            page: backendData.meta.page,
            limit: backendData.meta.limit,
            total_pages: Math.ceil(backendData.meta.total / backendData.meta.limit)
        };
    }

    /**
     * 내가 쓴 댓글 목록
     * 🔒 인증 필요
     */
    async getMyComments(page = 1, limit = 20): Promise<PaginatedResponse<FreeComment>> {
        interface BackendResponse {
            data: FreeComment[];
            meta: { page: number; limit: number; total: number };
        }

        const response = await this.request<BackendResponse>(
            `/my/comments?page=${page}&limit=${limit}`
        );

        const backendData = response as unknown as BackendResponse;

        return {
            items: backendData.data,
            total: backendData.meta.total,
            page: backendData.meta.page,
            limit: backendData.meta.limit,
            total_pages: Math.ceil(backendData.meta.total / backendData.meta.limit)
        };
    }

    /**
     * 내가 추천한 글 목록
     * 🔒 인증 필요
     */
    async getMyLikedPosts(page = 1, limit = 20): Promise<PaginatedResponse<FreePost>> {
        interface BackendResponse {
            data: FreePost[];
            meta: { page: number; limit: number; total: number };
        }

        const response = await this.request<BackendResponse>(
            `/my/liked-posts?page=${page}&limit=${limit}`
        );

        const backendData = response as unknown as BackendResponse;

        return {
            items: backendData.data,
            total: backendData.meta.total,
            page: backendData.meta.page,
            limit: backendData.meta.limit,
            total_pages: Math.ceil(backendData.meta.total / backendData.meta.limit)
        };
    }

    // ========================================
    // 차단 (Block)
    // ========================================

    /**
     * 차단 회원 목록 조회
     * 🔒 인증 필요
     */
    async getBlockedMembers(): Promise<BlockedMember[]> {
        const response = await this.request<BlockedMember[]>('/my/blocked');
        return response.data;
    }

    /**
     * 회원 차단
     * 🔒 인증 필요
     */
    async blockMember(memberId: string): Promise<void> {
        await this.request<void>(`/members/${memberId}/block`, { method: 'POST' });
    }

    /**
     * 회원 차단 해제
     * 🔒 인증 필요
     */
    async unblockMember(memberId: string): Promise<void> {
        await this.request<void>(`/members/${memberId}/block`, { method: 'DELETE' });
    }

    // ==================== 파일 업로드 API ====================

    /**
     * Presigned URL 요청 (S3 직접 업로드용)
     * 🔒 인증 필요
     */
    async getPresignedUrl(
        boardId: string,
        filename: string,
        contentType: string
    ): Promise<PresignedUrlResponse> {
        const response = await this.request<PresignedUrlResponse>(
            `/boards/${boardId}/upload/presign`,
            {
                method: 'POST',
                body: JSON.stringify({ filename, content_type: contentType })
            }
        );
        return response.data;
    }

    /**
     * 파일 직접 업로드 (서버 경유)
     * 🔒 인증 필요
     */
    async uploadFile(boardId: string, file: File, postId?: number): Promise<UploadedFile> {
        const formData = new FormData();
        formData.append('file', file);
        if (postId) {
            formData.append('post_id', String(postId));
        }

        // 토큰 가져오기
        const accessToken = this.getAccessToken();

        const response = await fetch(`${API_BASE_URL}/boards/${boardId}/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: {
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '파일 업로드에 실패했습니다.');
        }

        const result = (await response.json()) as ApiResponse<UploadedFile>;
        return result.data;
    }

    /**
     * 이미지 업로드 (이미지 전용, 썸네일 자동 생성)
     * 🔒 인증 필요
     */
    async uploadImage(boardId: string, file: File, postId?: number): Promise<UploadedFile> {
        // 이미지 파일인지 확인
        if (!file.type.startsWith('image/')) {
            throw new Error('이미지 파일만 업로드할 수 있습니다.');
        }

        const formData = new FormData();
        formData.append('image', file);
        if (postId) {
            formData.append('post_id', String(postId));
        }

        // 토큰 가져오기
        const accessToken = this.getAccessToken();

        const response = await fetch(`${API_BASE_URL}/boards/${boardId}/upload/image`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: {
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '이미지 업로드에 실패했습니다.');
        }

        const result = (await response.json()) as ApiResponse<UploadedFile>;
        return result.data;
    }

    /**
     * 게시글 첨부파일 목록 조회
     */
    async getPostAttachments(boardId: string, postId: number): Promise<PostAttachment[]> {
        const response = await this.request<PostAttachment[]>(
            `/boards/${boardId}/posts/${postId}/attachments`
        );
        return response.data;
    }

    /**
     * 첨부파일 삭제
     * 🔒 인증 필요
     */
    async deleteAttachment(boardId: string, postId: number, attachmentId: string): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}/attachments/${attachmentId}`, {
            method: 'DELETE'
        });
    }

    // ==================== 신고 API ====================

    /**
     * 게시글 신고
     * 🔒 인증 필요
     */
    async reportPost(boardId: string, postId: number, request: CreateReportRequest): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}/report`, {
            method: 'POST',
            body: JSON.stringify(request)
        });
    }

    /**
     * 댓글 신고
     * 🔒 인증 필요
     */
    async reportComment(
        boardId: string,
        postId: number,
        commentId: number | string,
        request: CreateReportRequest
    ): Promise<void> {
        await this.request<void>(
            `/boards/${boardId}/posts/${postId}/comments/${commentId}/report`,
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        );
    }

    // ==================== 포인트 API ====================

    /**
     * 현재 보유 포인트 조회
     */
    async getMyPoint(): Promise<PointSummary> {
        const response = await this.request<PointSummary>('/my/point');
        return response.data;
    }

    /**
     * 포인트 내역 조회
     */
    async getPointHistory(page: number = 1, limit: number = 20): Promise<PointHistoryResponse> {
        const response = await this.request<PointHistoryResponse>(
            `/my/point/history?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    // ==================== 알림 API ====================

    /**
     * 읽지 않은 알림 수 조회
     */
    async getUnreadNotificationCount(): Promise<NotificationSummary> {
        const response = await this.request<NotificationSummary>('/notifications/unread-count');
        return response.data;
    }

    /**
     * 알림 목록 조회
     */
    async getNotifications(
        page: number = 1,
        limit: number = 20
    ): Promise<NotificationListResponse> {
        const response = await this.request<NotificationListResponse>(
            `/notifications?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    /**
     * 알림 읽음 처리
     */
    async markNotificationAsRead(notificationId: number): Promise<void> {
        await this.request<void>(`/notifications/${notificationId}/read`, {
            method: 'POST'
        });
    }

    /**
     * 모든 알림 읽음 처리
     */
    async markAllNotificationsAsRead(): Promise<void> {
        await this.request<void>('/notifications/read-all', {
            method: 'POST'
        });
    }

    /**
     * 알림 삭제
     */
    async deleteNotification(notificationId: number): Promise<void> {
        await this.request<void>(`/notifications/${notificationId}`, {
            method: 'DELETE'
        });
    }

    // ==================== 쪽지 API ====================

    /**
     * 쪽지 목록 조회
     */
    async getMessages(
        kind: MessageKind = 'recv',
        page: number = 1,
        limit: number = 20
    ): Promise<MessageListResponse> {
        const response = await this.request<MessageListResponse>(
            `/messages?kind=${kind}&page=${page}&limit=${limit}`
        );
        return response.data;
    }

    /**
     * 쪽지 상세 조회
     */
    async getMessage(messageId: number): Promise<Message> {
        const response = await this.request<Message>(`/messages/${messageId}`);
        return response.data;
    }

    /**
     * 쪽지 보내기
     */
    async sendMessage(request: SendMessageRequest): Promise<void> {
        await this.request<void>('/messages', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    }

    /**
     * 쪽지 삭제
     */
    async deleteMessage(messageId: number): Promise<void> {
        await this.request<void>(`/messages/${messageId}`, {
            method: 'DELETE'
        });
    }

    /**
     * 읽지 않은 쪽지 수 조회
     */
    async getUnreadMessageCount(): Promise<{ count: number }> {
        const response = await this.request<{ count: number }>('/messages/unread-count');
        return response.data;
    }

    // ==================== 경험치 API ====================

    /**
     * 경험치 요약 조회
     */
    async getExpSummary(): Promise<ExpSummary> {
        const response = await this.request<ExpSummary>('/my/exp');
        return response.data;
    }

    /**
     * 경험치 내역 조회
     */
    async getExpHistory(page: number = 1, limit: number = 20): Promise<ExpHistoryResponse> {
        const response = await this.request<ExpHistoryResponse>(
            `/my/exp/history?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    // ==================== 인증 API ====================

    /**
     * 아이디/비밀번호 로그인
     */
    async login(request: LoginRequest): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        // 액세스 토큰 저장
        if (browser && response.data.access_token) {
            localStorage.setItem('access_token', response.data.access_token);
        }

        return response.data;
    }

    /**
     * OAuth 로그인 URL 가져오기
     */
    getOAuthLoginUrl(provider: OAuthProvider): string {
        const redirectUri = browser ? `${window.location.origin}/auth/callback/${provider}` : '';
        return `${API_BASE_URL}/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    /**
     * OAuth 콜백 처리
     */
    async handleOAuthCallback(request: OAuthLoginRequest): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>('/auth/oauth/callback', {
            method: 'POST',
            body: JSON.stringify(request)
        });

        // 액세스 토큰 저장
        if (browser && response.data.access_token) {
            localStorage.setItem('access_token', response.data.access_token);
        }

        return response.data;
    }

    /**
     * 회원가입
     */
    async register(request: RegisterRequest): Promise<RegisterResponse> {
        const response = await this.request<RegisterResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(request)
        });
        return response.data;
    }

    /**
     * 로그아웃 (토큰 제거)
     */
    async logoutUser(): Promise<void> {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // 로컬 토큰 제거
            if (browser) {
                localStorage.removeItem('access_token');
            }
        }
    }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();
