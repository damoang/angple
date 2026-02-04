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
    RegisterResponse,
    PostRevision,
    Scrap,
    BoardGroup
} from './types.js';
import { browser } from '$app/environment';
import { ApiRequestError } from './errors.js';
import { fetchWithRetry, type RetryConfig, DEFAULT_RETRY_CONFIG } from './retry.js';

// 서버/클라이언트 환경에 따라 API URL 분기
// 클라이언트: 상대경로 (nginx 프록시)
// SSR: Docker 내부 네트워크 직접 통신
const API_BASE_URL = browser
    ? '/api/v2'
    : process.env.INTERNAL_API_URL || 'http://localhost:8081/api/v2';

/**
 * API 클라이언트
 *
 * 🔒 보안 기능:
 * - httpOnly cookie를 사용한 Refresh Token 관리 (XSS 공격 방지)
 * - Access Token은 메모리에만 저장 (localStorage 사용 안 함)
 * - 모든 요청에 credentials: 'include'로 쿠키 자동 전송
 * - 401 응답 시 자동 토큰 갱신 후 재시도
 */
class ApiClient {
    // 메모리 기반 액세스 토큰 (XSS 공격 방지)
    private _accessToken: string | null = null;
    private _refreshPromise: Promise<boolean> | null = null;

    /** 액세스 토큰을 메모리에 설정 */
    setAccessToken(token: string | null): void {
        this._accessToken = token;
    }

    /** 현재 액세스 토큰 조회 (메모리에서만) */
    getAccessToken(): string | null {
        if (!browser) return null;
        if (this._accessToken) return this._accessToken;

        // 하위 호환: damoang_jwt 쿠키 확인 (damoang.net SSO)
        const jwtCookie = document.cookie.split('; ').find((row) => row.startsWith('damoang_jwt='));
        if (jwtCookie) {
            return jwtCookie.split('=')[1];
        }
        return null;
    }

    /** refreshToken 쿠키로 accessToken 자동 갱신 */
    async tryRefreshToken(): Promise<boolean> {
        if (this._refreshPromise) return this._refreshPromise;

        this._refreshPromise = (async () => {
            try {
                const url = `${API_BASE_URL}/auth/refresh`;
                const response = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) return false;
                const data = await response.json();
                const newToken = data?.data?.access_token;
                if (newToken) {
                    this._accessToken = newToken;
                    return true;
                }
                return false;
            } catch {
                return false;
            } finally {
                this._refreshPromise = null;
            }
        })();

        return this._refreshPromise;
    }

    // HTTP 요청 헬퍼
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retryConfig?: Partial<RetryConfig>,
        _isRetryAfterRefresh = false
    ): Promise<ApiResponse<T>> {
        const url = `${API_BASE_URL}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>)
        };

        const accessToken = this.getAccessToken();
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

        try {
            const response = await fetchWithRetry(
                url,
                {
                    ...options,
                    headers,
                    credentials: 'include'
                },
                config
            );

            // 204 No Content
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                if (!response.ok) throw new Error('요청 실패');
                return { data: undefined as T } as ApiResponse<T>;
            }

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('[API] JSON 파싱 에러:', parseError);
                    throw new Error('서버 응답을 처리할 수 없습니다.');
                }
            } else {
                if (!response.ok) throw new Error(`서버 에러 (${response.status})`);
                return { data: undefined as T } as ApiResponse<T>;
            }

            // 401 → 자동 토큰 갱신 후 재시도 (1회만)
            if (response.status === 401 && !_isRetryAfterRefresh && browser) {
                const refreshed = await this.tryRefreshToken();
                if (refreshed) {
                    return this.request<T>(endpoint, options, retryConfig, true);
                }
            }

            if (!response.ok) {
                let errorMessage = '요청 실패';
                let errorCode: string | undefined;
                if (data?.error) {
                    if (typeof data.error === 'string') {
                        errorMessage = data.error;
                    } else if (typeof data.error === 'object') {
                        errorMessage = data.error.message || data.error.details || '요청 실패';
                        errorCode = data.error.code;
                    }
                } else if (data?.message) {
                    errorMessage = data.message;
                }
                throw ApiRequestError.fromStatus(response.status, errorMessage, errorCode);
            }

            return data as ApiResponse<T>;
        } catch (error) {
            if (error instanceof ApiRequestError) throw error;
            throw ApiRequestError.network(
                error instanceof Error ? error.message : '알 수 없는 에러'
            );
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

    // 게시글 공지 상단고정 토글
    async toggleNotice(
        boardId: string,
        postId: number,
        noticeType: 'normal' | 'important' | null
    ): Promise<{ success: boolean }> {
        return this.request(`/boards/${boardId}/posts/${postId}/notice`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notice_type: noticeType })
        });
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
        // API가 직접 데이터를 반환하는지 { data: ... }로 감싸는지 확인
        const data = response as unknown as RecommendedDataWithAI;
        if (data?.sections !== undefined) {
            return data;
        }
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
            return null;
        }
    }

    // 인덱스 위젯 데이터 조회
    // 참고: 이 API는 다른 엔드포인트와 달리 { data: ... } 래퍼 없이 직접 데이터를 반환함
    async getIndexWidgets(): Promise<IndexWidgetsData | null> {
        try {
            const response = await this.request<IndexWidgetsData>('/recommended/index-widgets');
            // API가 데이터를 직접 반환하거나 { data: ... } 형태로 반환하는 경우 모두 처리
            const data = response as unknown as IndexWidgetsData;
            // news_tabs 필드가 있으면 직접 반환된 데이터, 없으면 response.data 시도
            if (data?.news_tabs !== undefined) {
                return data;
            }
            return response?.data ?? null;
        } catch (error) {
            console.error('[API] getIndexWidgets failed:', error);
            return null;
        }
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
     * 게시글 삭제 (소프트 삭제)
     * 🔒 인증 필요 + 작성자 본인 또는 관리자
     */
    async deletePost(boardId: string, postId: string): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}/soft-delete`, {
            method: 'PATCH'
        });
    }

    /**
     * 게시글 복구 (소프트 삭제 취소)
     * 🔒 관리자 전용
     */
    async restorePost(boardId: string, postId: string): Promise<FreePost> {
        const response = await this.request<FreePost>(
            `/boards/${boardId}/posts/${postId}/restore`,
            { method: 'POST' }
        );
        return response.data;
    }

    /**
     * 게시글 영구 삭제
     * 🔒 관리자 전용
     */
    async permanentDeletePost(boardId: string, postId: string): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}/permanent`, {
            method: 'DELETE'
        });
    }

    /**
     * 삭제된 게시글 목록 조회
     * 🔒 관리자 전용
     */
    async getDeletedPosts(
        page: number = 1,
        limit: number = 20
    ): Promise<PaginatedResponse<FreePost>> {
        const response = await this.request<PaginatedResponse<FreePost>>(
            `/admin/posts/deleted?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    // ========================================
    // 수정 이력 (Revision)
    // ========================================

    /**
     * 게시글 수정 이력 조회
     * 🔒 작성자 또는 관리자
     */
    async getPostRevisions(boardId: string, postId: string): Promise<PostRevision[]> {
        const response = await this.request<PostRevision[]>(
            `/boards/${boardId}/posts/${postId}/revisions`
        );
        return response.data;
    }

    /**
     * 특정 버전 조회
     */
    async getPostRevision(boardId: string, postId: string, version: number): Promise<PostRevision> {
        const response = await this.request<PostRevision>(
            `/boards/${boardId}/posts/${postId}/revisions/${version}`
        );
        return response.data;
    }

    /**
     * 이전 버전으로 복원
     * 🔒 작성자 또는 관리자
     */
    async restoreRevision(boardId: string, postId: string, version: number): Promise<FreePost> {
        const response = await this.request<FreePost>(
            `/boards/${boardId}/posts/${postId}/revisions/${version}/restore`,
            { method: 'POST' }
        );
        return response.data;
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
    // 스크랩 (Scrap/Bookmark)
    // ========================================

    /**
     * 게시글 스크랩 추가
     * 🔒 인증 필요
     */
    async scrapPost(postId: string, memo?: string): Promise<Scrap> {
        const response = await this.request<Scrap>(`/posts/${postId}/scrap`, {
            method: 'POST',
            body: memo ? JSON.stringify({ memo }) : undefined
        });
        return response.data;
    }

    /**
     * 게시글 스크랩 해제
     * 🔒 인증 필요
     */
    async unscrapPost(postId: string): Promise<void> {
        await this.request<void>(`/posts/${postId}/scrap`, {
            method: 'DELETE'
        });
    }

    /**
     * 내 스크랩 목록 조회
     * 🔒 인증 필요
     */
    async getMyScraps(page: number = 1, limit: number = 20): Promise<PaginatedResponse<Scrap>> {
        const response = await this.request<PaginatedResponse<Scrap>>(
            `/my/scraps?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    /**
     * 게시글 스크랩 여부 확인
     * 🔒 인증 필요
     */
    async getScrapStatus(postId: string): Promise<{ scrapped: boolean }> {
        const response = await this.request<{ scrapped: boolean }>(`/posts/${postId}/scrap/status`);
        return response.data;
    }

    // ========================================
    // 게시판 그룹 (Board Groups)
    // ========================================

    /**
     * 게시판 그룹 목록 조회 (게시판 포함)
     */
    async getBoardGroups(): Promise<BoardGroup[]> {
        const response = await this.request<BoardGroup[]>('/board-groups');
        return response.data;
    }

    /**
     * 게시판 그룹 생성
     * 🔒 관리자 전용
     */
    async createBoardGroup(data: {
        id: string;
        name: string;
        description?: string;
        sort_order?: number;
    }): Promise<BoardGroup> {
        const response = await this.request<BoardGroup>('/admin/board-groups', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response.data;
    }

    /**
     * 게시판 그룹 수정
     * 🔒 관리자 전용
     */
    async updateBoardGroup(
        groupId: string,
        data: { name?: string; description?: string; is_visible?: boolean }
    ): Promise<BoardGroup> {
        const response = await this.request<BoardGroup>(`/admin/board-groups/${groupId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return response.data;
    }

    /**
     * 게시판 그룹 삭제
     * 🔒 관리자 전용
     */
    async deleteBoardGroup(groupId: string): Promise<void> {
        await this.request<void>(`/admin/board-groups/${groupId}`, {
            method: 'DELETE'
        });
    }

    /**
     * 게시판 그룹 순서 변경
     * 🔒 관리자 전용
     */
    async reorderBoardGroups(groupIds: string[]): Promise<void> {
        await this.request<void>('/admin/board-groups/reorder', {
            method: 'PATCH',
            body: JSON.stringify({ group_ids: groupIds })
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
            body: JSON.stringify({
                username: request.user_id,
                password: request.password,
                remember: request.remember
            })
        });

        // 액세스 토큰을 메모리에 저장 (httpOnly 쿠키로 refreshToken은 자동 설정됨)
        if (response.data.access_token) {
            this._accessToken = response.data.access_token;
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

        // 액세스 토큰을 메모리에 저장
        if (response.data.access_token) {
            this._accessToken = response.data.access_token;
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
            this._accessToken = null;
        }
    }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();
