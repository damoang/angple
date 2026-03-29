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
    MyComment,
    BlockedMember,
    UploadedFile,
    PresignedUrlResponse,
    PostAttachment,
    CreateReportRequest,
    PointSummary,
    PointHistoryResponse,
    NotificationSummary,
    NotificationListResponse,
    GroupedNotificationListResponse,
    NotificationPreferences,
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
    BoardGroup,
    CommentReportInfo,
    TenorSearchResponse,
    FileAttachment,
    BoardStat
} from './types.js';
import { browser } from '$app/environment';
import { ApiRequestError } from './errors.js';
import { fetchWithRetry, type RetryConfig, DEFAULT_RETRY_CONFIG } from './retry.js';
import { safeRandomUUID } from '$lib/utils/uuid';

// 서버/클라이언트 환경에 따라 API URL 분기
// 클라이언트: 상대경로 (nginx 프록시)
// SSR: Docker 내부 네트워크 직접 통신
// Note: SSR에서는 $env/dynamic/private 사용, 클라이언트에서는 상대 경로
const API_BASE_URL = browser
    ? '/api/v1'
    : (typeof process !== 'undefined' && process.env?.INTERNAL_API_URL) ||
      'http://localhost:8090/api/v1';

// v2 API URL (인증 관련 - exchange 등)
const API_V2_URL = browser ? '/api/v2' : 'http://localhost:8090/api/v2';

const WRITE_REQUEST_CONFIG: Partial<RetryConfig> = {
    maxRetries: 0,
    timeout: 30000
};

// v2 API URL은 세션 기반 인증에서는 SvelteKit 프록시가 내부 JWT를 주입하므로
// 클라이언트에서 직접 사용할 일이 줄어듦 (exchangeToken 등 레거시 호환용으로 유지)

/**
 * API 클라이언트
 *
 * 🔒 보안 기능:
 * - httpOnly 세션 쿠키(angple_sid)로 인증 (서버사이드 세션)
 * - CSRF Double-submit: angple_csrf 쿠키에서 읽어 X-CSRF-Token 헤더로 전송
 * - 모든 요청에 credentials: 'include'로 쿠키 자동 전송
 * - 401 응답 시 자동 토큰 갱신 후 재시도 (레거시 호환)
 */
class ApiClient {
    // 메모리 기반 액세스 토큰 (SSR에서 받은 내부 JWT, Go 백엔드 통신용)
    private _accessToken: string | null = null;
    private _fetchFn: typeof fetch | null = null;
    private _idempotencyKeys = new Map<string, { key: string; expiresAt: number }>();

    private stableSerialize(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value as Record<string, unknown>)
                .filter(([, entryValue]) => entryValue !== undefined)
                .sort(([a], [b]) => a.localeCompare(b));
            return `{${entries
                .map(([key, entryValue]) => `${key}:${this.stableSerialize(entryValue)}`)
                .join(',')}}`;
        }
        return String(value);
    }

    private createRandomIdempotencyKey(scope: string): string {
        return `${scope}:${safeRandomUUID()}`;
    }

    private createIdempotencyKey(scope: string, payload?: unknown): string {
        if (payload === undefined) {
            return this.createRandomIdempotencyKey(scope);
        }

        const now = Date.now();
        for (const [fingerprint, cached] of this._idempotencyKeys.entries()) {
            if (cached.expiresAt <= now) {
                this._idempotencyKeys.delete(fingerprint);
            }
        }

        const fingerprint = `${scope}:${this.stableSerialize(payload)}`;
        const cached = this._idempotencyKeys.get(fingerprint);
        if (cached && cached.expiresAt > now) {
            return cached.key;
        }

        const key = this.createRandomIdempotencyKey(scope);
        this._idempotencyKeys.set(fingerprint, {
            key,
            expiresAt: now + 90_000
        });
        return key;
    }

    /** SvelteKit load 함수에서 제공하는 fetch를 임시 주입 (1회성) */
    withFetch(fn: typeof fetch): this {
        this._fetchFn = fn;
        return this;
    }

    /** 액세스 토큰을 메모리에 설정 */
    setAccessToken(token: string | null): void {
        this._accessToken = token;
    }

    /** 현재 액세스 토큰 조회 (메모리에서만, SSR 데이터로 설정됨) */
    getAccessToken(): string | null {
        if (!browser) return null;
        return this._accessToken;
    }

    /** CSRF 토큰 읽기 (angple_csrf 쿠키) */
    private getCsrfToken(): string | null {
        if (!browser) return null;
        const match = document.cookie.split('; ').find((r) => r.startsWith('angple_csrf='));
        return match ? match.split('=')[1] : null;
    }

    /** CSRF 헤더 포함한 headers 객체 생성 (직접 fetch 사용 시) */
    private buildHeaders(extra?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = { ...extra };
        const csrfToken = this.getCsrfToken();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
        return headers;
    }

    /**
     * @deprecated 세션 기반 인증에서는 토큰 갱신 불필요
     * 서버가 세션 쿠키로 인증하므로 클라이언트 토큰 관리 없음
     */
    async tryRefreshToken(): Promise<boolean> {
        return !!this._accessToken;
    }

    // HTTP 요청 헬퍼
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retryConfig?: Partial<RetryConfig>
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

        // CSRF 토큰: POST/PUT/PATCH/DELETE 요청에 자동 포함
        const method = (options.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            const csrfToken = this.getCsrfToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }
        }

        const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

        // SvelteKit fetch 주입 (1회성 사용 후 초기화)
        const fetchFn = this._fetchFn || fetch;
        this._fetchFn = null;

        try {
            const response = await fetchWithRetry(
                url,
                {
                    ...options,
                    headers,
                    credentials: 'include'
                },
                config,
                fetchFn
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
        limit = 10,
        options?: { summary?: boolean }
    ): Promise<PaginatedResponse<FreePost>> {
        interface BackendResponse {
            data: FreePost[];
            meta: {
                board_id: string;
                page: number;
                limit: number;
                total?: number;
                has_next?: boolean;
            };
        }

        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit)
        });
        if (options?.summary) {
            params.set('summary', '1');
        }

        const response = await this.request<BackendResponse>(`/boards/${boardId}/posts?${params}`);

        const backendData = response as unknown as BackendResponse;
        const meta = backendData.meta;
        const currentPage = meta?.page || page;

        // total이 있으면 정확한 total_pages, 없으면 has_next 기반
        let totalPages = 0;
        if (meta?.total && meta?.limit) {
            totalPages = Math.ceil(meta.total / meta.limit);
        } else if (meta?.has_next) {
            totalPages = currentPage + 1;
        } else {
            totalPages = currentPage;
        }

        const result: PaginatedResponse<FreePost> = {
            items: backendData.data || [],
            total: meta?.total || 0,
            page: currentPage,
            limit: meta?.limit || limit,
            total_pages: totalPages
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
        limit = 200
    ): Promise<PaginatedResponse<FreeComment>> {
        const fetchFn = this._fetchFn || fetch;
        this._fetchFn = null;
        try {
            const res = await fetchFn(
                `/api/boards/${boardId}/posts/${postId}/comments?page=${page}&limit=${limit}`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (!json.success) {
                return { items: [], total: 0, page, limit, total_pages: 0 };
            }
            const data = json.data;
            return {
                items: data.comments || [],
                total: data.total || 0,
                page: data.page || page,
                limit: data.limit || limit,
                total_pages: data.total_pages || 1
            };
        } catch {
            return { items: [], total: 0, page, limit, total_pages: 0 };
        }
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
        limit = 200
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

    // 게시글 첨부파일 조회
    async getPostFiles(boardId: string, postId: string): Promise<FileAttachment[]> {
        interface BackendFilesResponse {
            data: FileAttachment[];
        }

        try {
            const response = await this.request<BackendFilesResponse>(
                `/boards/${boardId}/posts/${postId}/files`
            );
            const backendData = response as unknown as BackendFilesResponse;
            return backendData.data || [];
        } catch {
            // 파일이 없거나 오류 발생 시 빈 배열 반환
            return [];
        }
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
    // 1순위: /auth/me (레거시 SSO 쿠키 기반)
    // 2순위: /auth/profile (JWT 기반 - Go API 자체 인증)
    async getCurrentUser(): Promise<DamoangUser | null> {
        let userData: DamoangUser | null = null;

        // 1. 먼저 레거시 SSO 쿠키 기반 인증 시도
        try {
            const meResponse = await this.request<DamoangUser>('/auth/me');
            if (meResponse.data && meResponse.data.mb_id) {
                userData = meResponse.data;
            }
        } catch {
            // /auth/me 실패 시 무시하고 /auth/profile 시도
        }

        // 2. JWT 기반 인증 시도 (Go API 자체 로그인)
        if (!userData) {
            try {
                interface ProfileResponse {
                    user_id: string;
                    nickname: string;
                    level: number;
                }
                const response = await this.request<ProfileResponse>('/auth/profile');
                if (!response.data) {
                    return null;
                }
                userData = {
                    mb_id: response.data.user_id,
                    mb_name: response.data.nickname,
                    mb_level: response.data.level,
                    mb_email: ''
                };
            } catch {
                return null;
            }
        }

        // 3. 포인트/경험치 데이터 보강 (누락된 경우에만)
        if (userData && (userData.mb_point === undefined || userData.mb_exp === undefined)) {
            const [pointData, expData] = await Promise.all([
                userData.mb_point === undefined
                    ? this.request<PointSummary>('/my/point').catch(() => null)
                    : null,
                userData.mb_exp === undefined
                    ? this.request<ExpSummary>('/my/exp').catch(() => null)
                    : null
            ]);

            if (pointData?.data) {
                userData.mb_point = pointData.data.total_point;
            }
            if (expData?.data) {
                userData.mb_exp = expData.data.total_exp;
                userData.as_level = expData.data.current_level;
                userData.as_max = expData.data.total_exp + expData.data.next_level_exp;
            }
        }

        // 포인트/레벨 기본값 (API 미응답 시에도 UI 표시)
        if (userData) {
            if (userData.mb_point === undefined) userData.mb_point = 0;
            if (userData.mb_exp === undefined) userData.mb_exp = 0;
        }

        return userData;
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
        const response = await this.request<FreePost>(
            `/boards/${boardId}/posts`,
            {
                method: 'POST',
                headers: {
                    'X-Idempotency-Key': this.createIdempotencyKey(
                        `post-create:${boardId}`,
                        request
                    )
                },
                body: JSON.stringify(request)
            },
            WRITE_REQUEST_CONFIG
        );

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
        const response = await this.request<FreePost>(
            `/boards/${boardId}/posts/${postId}`,
            {
                method: 'PUT',
                headers: {
                    'X-Idempotency-Key': this.createIdempotencyKey(
                        `post-update:${boardId}:${postId}`,
                        request
                    )
                },
                body: JSON.stringify(request)
            },
            WRITE_REQUEST_CONFIG
        );

        return response.data;
    }

    /**
     * 게시글 삭제 (소프트 삭제)
     * 🔒 인증 필요 + 작성자 본인 또는 관리자
     */
    async deletePost(
        boardId: string,
        postId: string
    ): Promise<{
        scheduled?: boolean;
        scheduled_at?: string;
        delay_minutes?: number;
        message?: string;
    }> {
        const response = await this.request<{
            scheduled?: boolean;
            scheduled_at?: string;
            delay_minutes?: number;
            message?: string;
        }>(`/boards/${boardId}/posts/${postId}/soft-delete`, {
            method: 'PATCH'
        });
        return response.data ?? {};
    }

    /**
     * 게시글 삭제 예약 상태 조회
     */
    async getPostDeleteStatus(
        boardId: string,
        postId: string
    ): Promise<{
        scheduled: boolean;
        scheduled_at?: string;
        requested_at?: string;
        delay_minutes?: number;
    }> {
        const response = await this.request<{
            scheduled: boolean;
            scheduled_at?: string;
            requested_at?: string;
            delay_minutes?: number;
        }>(`/boards/${boardId}/posts/${postId}/delete-status`);
        return response.data ?? { scheduled: false };
    }

    /**
     * 게시글 삭제 예약 취소
     * 🔒 인증 필요 + 작성자 본인 또는 관리자
     */
    async cancelScheduledDelete(
        boardId: string,
        postId: string
    ): Promise<{ success: boolean; message: string }> {
        const response = await this.request<{ success: boolean; message: string }>(
            `/boards/${boardId}/posts/${postId}/cancel-delete`,
            {
                method: 'POST'
            }
        );
        return response.data ?? { success: false, message: '' };
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

    /**
     * 댓글 수정 이력 조회
     * 🔒 관리자 전용 (level ≥ 10)
     */
    async getCommentRevisions(
        boardId: string,
        postId: string,
        commentId: string
    ): Promise<PostRevision[]> {
        const response = await this.request<PostRevision[]>(
            `/boards/${boardId}/posts/${postId}/comments/${commentId}/revisions`
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
                headers: {
                    'X-Idempotency-Key': this.createIdempotencyKey(
                        `comment-create:${boardId}:${postId}`,
                        request
                    )
                },
                body: JSON.stringify(request)
            },
            WRITE_REQUEST_CONFIG
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
                headers: {
                    'X-Idempotency-Key': this.createIdempotencyKey(
                        `comment-update:${boardId}:${postId}:${commentId}`,
                        request
                    )
                },
                body: JSON.stringify(request)
            },
            WRITE_REQUEST_CONFIG
        );

        return response.data;
    }

    /**
     * 댓글 삭제
     * 🔒 인증 필요 + 작성자 본인만 가능
     */
    async deleteComment(boardId: string, postId: string, commentId: string): Promise<void> {
        // SvelteKit API 라우트로 직접 요청 (gnuboard 테이블 기반)
        const res = await fetch(`/api/boards/${boardId}/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || '댓글 삭제에 실패했습니다.');
        }
    }

    async restoreComment(boardId: string, postId: string, commentId: string): Promise<void> {
        await this.request<void>(
            `/boards/${boardId}/posts/${postId}/comments/${commentId}/restore`,
            { method: 'POST' }
        );
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
    // 관리자 게시글 관리 (Admin Post Management)
    // ========================================

    /**
     * 게시글 이동 (다른 게시판으로)
     * 🔒 관리자 전용
     */
    async movePost(
        boardId: string,
        postId: number | string,
        targetBoardId: string
    ): Promise<{ success: boolean; new_post_id?: number; target_board_id: string }> {
        const response = await this.request<{
            success: boolean;
            new_post_id?: number;
            target_board_id: string;
        }>(`/boards/${boardId}/posts/${postId}/move`, {
            method: 'POST',
            body: JSON.stringify({ target_board_id: targetBoardId })
        });
        return response.data;
    }

    /**
     * 게시글 잠금/해제
     * 🔒 관리자 전용
     */
    async lockPost(boardId: string, postId: number | string, lock: boolean): Promise<void> {
        await this.request(`/boards/${boardId}/posts/${postId}/lock`, {
            method: 'PATCH',
            body: JSON.stringify({ lock })
        });
    }

    /**
     * 게시글 카테고리 변경
     * 🔒 관리자 전용
     */
    async changePostCategory(
        boardId: string,
        postId: number | string,
        category: string
    ): Promise<void> {
        await this.request<void>(`/boards/${boardId}/posts/${postId}/category`, {
            method: 'PATCH',
            body: JSON.stringify({ category })
        });
    }

    /**
     * 게시글 일괄 삭제
     * 🔒 관리자 전용
     */
    async bulkDeletePosts(
        boardId: string,
        postIds: number[]
    ): Promise<{ success: boolean; affected_count: number }> {
        const response = await this.request<{ success: boolean; affected_count: number }>(
            `/boards/${boardId}/posts/bulk-delete`,
            {
                method: 'POST',
                body: JSON.stringify({ post_ids: postIds })
            }
        );
        return response.data;
    }

    /**
     * 게시글 일괄 이동
     * 🔒 관리자 전용
     */
    async bulkMovePosts(
        boardId: string,
        postIds: number[],
        targetBoardId: string
    ): Promise<{ success: boolean; affected_count: number }> {
        const response = await this.request<{ success: boolean; affected_count: number }>(
            `/boards/${boardId}/posts/bulk-move`,
            {
                method: 'POST',
                body: JSON.stringify({ post_ids: postIds, target_board_id: targetBoardId })
            }
        );
        return response.data;
    }

    // ========================================
    // 추천/비추천 (Like/Dislike)
    // ========================================

    /**
     * 게시글 추천 (레거시 g5_board_good 기반)
     * 🔒 인증 필요
     */
    async likePost(boardId: string, postId: string): Promise<LikeResponse> {
        const res = await fetch(`/api/boards/${boardId}/posts/${postId}/like`, {
            method: 'POST',
            headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({ action: 'good' })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || '공감에 실패했습니다.');
        return json.data;
    }

    /**
     * 게시글 비추천 (레거시 g5_board_good 기반)
     * 🔒 인증 필요
     */
    async dislikePost(boardId: string, postId: string): Promise<LikeResponse> {
        const res = await fetch(`/api/boards/${boardId}/posts/${postId}/like`, {
            method: 'POST',
            headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({ action: 'nogood' })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || '비공감에 실패했습니다.');
        return json.data;
    }

    /**
     * 게시글 추천 상태 조회 (레거시 g5_board_good 기반)
     */
    async getPostLikeStatus(boardId: string, postId: string): Promise<LikeResponse> {
        const res = await fetch(`/api/boards/${boardId}/posts/${postId}/like`, {
            credentials: 'include'
        });
        const json = await res.json();
        if (!json.success) return { likes: 0, user_liked: false };
        return json.data;
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
        const payload = response.data;
        return {
            likers: Array.isArray(payload?.likers) ? payload.likers : [],
            total: typeof payload?.total === 'number' ? payload.total : 0
        };
    }

    /**
     * 댓글 추천자 목록 조회
     */
    async getCommentLikers(
        boardId: string,
        postId: string,
        commentId: string,
        page = 1,
        limit = 20
    ): Promise<LikersResponse> {
        try {
            const res = await fetch(
                `/api/boards/${boardId}/posts/${postId}/comments/${commentId}/likers?page=${page}&limit=${limit}`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (!json.success) return { likers: [], total: 0 };
            return json.data;
        } catch {
            return { likers: [], total: 0 };
        }
    }

    /**
     * 댓글 추천자 배치 조회 (여러 댓글을 한 번에)
     */
    async getCommentLikersBatch(
        boardId: string,
        postId: string,
        commentIds: string[],
        limit = 5
    ): Promise<Record<string, LikersResponse>> {
        try {
            const ids = commentIds.join(',');
            const res = await fetch(
                `/api/boards/${boardId}/posts/${postId}/comments/likers-batch?commentIds=${ids}&limit=${limit}`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (!json.success) return {};
            return json.data;
        } catch {
            return {};
        }
    }

    /**
     * 댓글 추천 (SvelteKit 라우트 — g5_board_good 기반)
     * 🔒 인증 필요
     */
    async likeComment(boardId: string, postId: string, commentId: string): Promise<LikeResponse> {
        const res = await fetch(
            `/api/boards/${boardId}/posts/${postId}/comments/${commentId}/like`,
            {
                method: 'POST',
                headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify({ action: 'good' })
            }
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.message || '댓글 공감에 실패했습니다.');
        return json.data;
    }

    /**
     * 댓글 비추천 (SvelteKit 라우트 — g5_board_good 기반)
     * 🔒 인증 필요
     */
    async dislikeComment(
        boardId: string,
        postId: string,
        commentId: string
    ): Promise<LikeResponse> {
        const res = await fetch(
            `/api/boards/${boardId}/posts/${postId}/comments/${commentId}/like`,
            {
                method: 'POST',
                headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify({ action: 'nogood' })
            }
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.message || '댓글 비공감에 실패했습니다.');
        return json.data;
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
        if (params.tag) {
            queryParams.set('tag', params.tag);
        }

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

        // Sphinx 기반 SvelteKit API route 직접 호출 (/api/search)
        const res = await fetch(`/api/search?${queryParams.toString()}`);
        const json = await res.json();
        if (!json.success) {
            throw new Error(json.error || '검색 실패');
        }
        return json.data;
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
        const response = await this.request<unknown>(`/my/posts?page=${page}&limit=${limit}`);

        const raw = response as unknown as Record<string, unknown>;
        const meta = raw.meta as Record<string, number> | undefined;
        const items = (raw.data as FreePost[]) ?? (raw.items as FreePost[]) ?? [];
        const total = meta?.total ?? (raw.total as number) ?? 0;
        const responsePage = meta?.page ?? (raw.page as number) ?? page;
        const responseLimit = meta?.limit ?? (raw.limit as number) ?? limit;

        return {
            items,
            total,
            page: responsePage,
            limit: responseLimit,
            total_pages: responseLimit > 0 ? Math.ceil(total / responseLimit) : 0
        };
    }

    /**
     * 내가 쓴 댓글 목록
     * 🔒 인증 필요
     */
    async getMyComments(page = 1, limit = 20): Promise<PaginatedResponse<MyComment>> {
        const response = await this.request<unknown>(`/my/comments?page=${page}&limit=${limit}`);

        const raw = response as unknown as Record<string, unknown>;
        const meta = raw.meta as Record<string, number> | undefined;
        const items = (raw.data as MyComment[]) ?? (raw.items as MyComment[]) ?? [];
        const total = meta?.total ?? (raw.total as number) ?? 0;
        const responsePage = meta?.page ?? (raw.page as number) ?? page;
        const responseLimit = meta?.limit ?? (raw.limit as number) ?? limit;

        return {
            items,
            total,
            page: responsePage,
            limit: responseLimit,
            total_pages: responseLimit > 0 ? Math.ceil(total / responseLimit) : 0
        };
    }

    /**
     * 내가 추천한 글 목록
     * 🔒 인증 필요
     */
    async getMyLikedPosts(page = 1, limit = 20): Promise<PaginatedResponse<FreePost>> {
        const response = await this.request<unknown>(`/my/liked-posts?page=${page}&limit=${limit}`);

        const raw = response as unknown as Record<string, unknown>;
        const meta = raw.meta as Record<string, number> | undefined;
        const items = (raw.data as FreePost[]) ?? (raw.items as FreePost[]) ?? [];
        const total = meta?.total ?? (raw.total as number) ?? 0;
        const responsePage = meta?.page ?? (raw.page as number) ?? page;
        const responseLimit = meta?.limit ?? (raw.limit as number) ?? limit;

        return {
            items,
            total,
            page: responsePage,
            limit: responseLimit,
            total_pages: responseLimit > 0 ? Math.ceil(total / responseLimit) : 0
        };
    }

    /**
     * 게시판별 통계 조회
     * 🔒 인증 필요
     */
    async getBoardStats(): Promise<BoardStat[]> {
        const response = await this.request<BoardStat[]>('/my/stats');
        return response.data ?? [];
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

    // ==================== 프로필 이미지 API ====================

    /**
     * 프로필 이미지 업로드
     * 🔒 인증 필요
     */
    async uploadMemberImage(file: File): Promise<{ url: string }> {
        const formData = new FormData();
        formData.append('image', file);

        const headers: Record<string, string> = {};
        const token = this.getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/members/me/image', {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            let errorMessage = '프로필 이미지 업로드에 실패했습니다.';
            try {
                const parsed = JSON.parse(errorBody);
                errorMessage = parsed.error || parsed.message || errorMessage;
            } catch {
                // ignore
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * 프로필 이미지 삭제
     * 🔒 인증 필요
     */
    async deleteMemberImage(): Promise<void> {
        const headers: Record<string, string> = {};
        const token = this.getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/members/me/image', {
            method: 'DELETE',
            headers,
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('프로필 이미지 삭제에 실패했습니다.');
        }
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
     * 파일 업로드 (SvelteKit /api/media/images → S3, IAM Role 인증)
     * 🔒 인증 필요
     */
    async uploadFile(boardId: string, file: File, postId?: number): Promise<UploadedFile> {
        const { convertHeicIfNeeded } = await import('$lib/utils/image-convert.js');
        file = await convertHeicIfNeeded(file);

        const formData = new FormData();
        formData.append('file', file);
        if (postId) {
            formData.append('post_id', String(postId));
        }

        const headers: Record<string, string> = {};
        const token = this.getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/media/images', {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            let errorMessage = '파일 업로드에 실패했습니다.';
            if (response.status === 413) {
                errorMessage = '파일 크기가 너무 큽니다.';
            } else {
                try {
                    const parsed = JSON.parse(errorBody);
                    errorMessage = parsed.error?.message || parsed.message || errorMessage;
                } catch {
                    // JSON 파싱 실패 → 기본 메시지 사용
                }
            }
            throw new Error(errorMessage);
        }

        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error('서버 응답을 처리할 수 없습니다.');
        }

        const data = result?.data;
        if (!data) {
            throw new Error('업로드 응답 데이터가 없습니다.');
        }

        return {
            id: data.key,
            filename: data.filename,
            original_filename: data.filename,
            url: data.cdn_url || data.url,
            size: data.size,
            mime_type: data.content_type,
            created_at: new Date().toISOString()
        };
    }

    /**
     * 이미지 업로드 (SvelteKit /api/media/images → S3, IAM Role 인증)
     * 🔒 인증 필요
     */
    async uploadImage(boardId: string, file: File, postId?: number): Promise<UploadedFile> {
        const { convertHeicIfNeeded, isImageFile } = await import('$lib/utils/image-convert.js');

        // 이미지 파일인지 확인 (HEIC 포함)
        if (!isImageFile(file)) {
            throw new Error('이미지 파일만 업로드할 수 있습니다.');
        }

        file = await convertHeicIfNeeded(file);

        const formData = new FormData();
        formData.append('file', file);
        if (postId) {
            formData.append('post_id', String(postId));
        }

        const headers: Record<string, string> = {};
        const token = this.getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const MAX_RETRIES = 2;
        const UPLOAD_TIMEOUT_MS = 30_000;
        let lastError: Error | null = null;
        let response: Response | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

                response = await fetch('/api/media/images', {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                break;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error('업로드 실패');
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }
            }
        }

        if (!response) {
            throw lastError ?? new Error('이미지 업로드에 실패했습니다. 네트워크를 확인해 주세요.');
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            let errorMessage = '이미지 업로드에 실패했습니다.';
            if (response.status === 413) {
                errorMessage = '파일 크기가 너무 큽니다. (최대 10MB)';
            } else {
                try {
                    const parsed = JSON.parse(errorBody);
                    errorMessage = parsed.error?.message || parsed.message || errorMessage;
                } catch {
                    // JSON 파싱 실패 (HTML 에러 페이지 등) → 기본 메시지 사용
                }
            }
            throw new Error(errorMessage);
        }

        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error('서버 응답을 처리할 수 없습니다.');
        }

        const data = result?.data;
        if (!data) {
            throw new Error('업로드 응답 데이터가 없습니다.');
        }

        return {
            id: data.key,
            filename: data.filename,
            original_filename: data.filename,
            url: data.cdn_url || data.url,
            size: data.size,
            mime_type: data.content_type,
            created_at: new Date().toISOString()
        };
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
        return response.data ?? { total_unread: 0 };
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

    /**
     * 그룹화 알림 목록 조회
     */
    async getGroupedNotifications(
        page: number = 1,
        limit: number = 20,
        filterType: string = ''
    ): Promise<GroupedNotificationListResponse> {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (filterType) params.set('type', filterType);
        const response = await this.request<GroupedNotificationListResponse>(
            `/notifications/grouped?${params}`
        );
        return response.data;
    }

    /**
     * 그룹 알림 읽음 처리
     */
    async markGroupAsRead(boTable: string, wrId: number, fromCase: string): Promise<void> {
        await this.request<void>('/notifications/group/read', {
            method: 'POST',
            body: JSON.stringify({ bo_table: boTable, wr_id: wrId, from_case: fromCase })
        });
    }

    /**
     * 그룹 알림 삭제
     */
    async deleteNotificationGroup(boTable: string, wrId: number, fromCase: string): Promise<void> {
        const params = new URLSearchParams({
            bo_table: boTable,
            wr_id: String(wrId),
            from_case: fromCase
        });
        await this.request<void>(`/notifications/group?${params}`, {
            method: 'DELETE'
        });
    }

    /**
     * 알림 설정 조회
     */
    async getNotificationPreferences(): Promise<NotificationPreferences> {
        const response = await this.request<NotificationPreferences>('/notifications/preferences');
        return (
            response.data ?? {
                noti_comment: true,
                noti_reply: true,
                noti_mention: true,
                noti_like: true,
                noti_follow: true,
                like_threshold: 1
            }
        );
    }

    /**
     * 알림 설정 업데이트
     */
    async updateNotificationPreferences(
        prefs: Partial<NotificationPreferences>
    ): Promise<NotificationPreferences> {
        const response = await this.request<NotificationPreferences>('/notifications/preferences', {
            method: 'PUT',
            body: JSON.stringify(prefs)
        });
        return response.data;
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
        // SvelteKit 프록시 경유: 세션 생성 + 쿠키 설정을 서버가 처리
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({
                username: request.username,
                password: request.password
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `로그인 실패 (${response.status})`);
        }

        const json = (await response.json()) as ApiResponse<LoginResponse>;
        if (!json.success) {
            throw new Error(json.message || '로그인에 실패했습니다');
        }

        const data = json.data;

        // 레거시 호환: 액세스 토큰을 메모리에 저장
        if (data.access_token) {
            this._accessToken = data.access_token;
        }

        return data;
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

    // ==================== Tenor GIF API ====================

    /**
     * Tenor GIF 검색 (서버 프록시 경유)
     */
    async searchGifs(query: string, pos = ''): Promise<TenorSearchResponse> {
        const params = new URLSearchParams({ q: query });
        if (pos) params.set('pos', pos);
        const res = await fetch(`/api/tenor/search?${params.toString()}`);
        if (!res.ok) throw new Error('GIF 검색에 실패했습니다.');
        return res.json();
    }

    /**
     * Tenor trending GIF (서버 프록시 경유)
     */
    async getFeaturedGifs(pos = ''): Promise<TenorSearchResponse> {
        const params = new URLSearchParams();
        if (pos) params.set('pos', pos);
        const qs = params.toString();
        const res = await fetch(`/api/tenor/featured${qs ? `?${qs}` : ''}`);
        if (!res.ok) throw new Error('인기 GIF 로드에 실패했습니다.');
        return res.json();
    }

    // ==================== 즐겨찾기 API ====================

    /**
     * 게시판 즐겨찾기 조회
     * 🔒 인증 필요
     */
    async getFavorites(): Promise<Record<string, { boardId: string; title: string }>> {
        const response =
            await this.request<Record<string, { boardId: string; title: string }>>('/my/favorites');
        return response.data ?? {};
    }

    /**
     * 게시판 즐겨찾기 저장 (전체 슬롯 덮어쓰기)
     * 🔒 인증 필요
     */
    async saveFavorites(
        favorites: Record<string, { boardId: string; title: string }>
    ): Promise<void> {
        await this.request<void>('/my/favorites', {
            method: 'PUT',
            body: JSON.stringify(favorites)
        });
    }

    // ==================== 댓글 신고 정보 (관리자) ====================

    /**
     * 댓글 신고 정보 조회 (관리자 전용)
     * 🔒 관리자 전용 (mb_level >= 10)
     */
    async getCommentReports(
        boardId: string,
        postId: number | string,
        includePost = false
    ): Promise<CommentReportInfo[]> {
        try {
            const qs = includePost ? '?include_post=1' : '';
            const res = await fetch(`/api/boards/${boardId}/posts/${postId}/comment-reports${qs}`, {
                credentials: 'include'
            });
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        } catch {
            return [];
        }
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

    /**
     * 레거시 SSO 쿠키를 angple JWT로 교환
     * 레거시 시스템 로그인 후 리다이렉트된 경우 자동 토큰 교환에 사용
     * NOTE: 이 엔드포인트는 v2 API에만 존재
     */
    async exchangeToken(): Promise<LoginResponse> {
        const response = await fetch(`${API_V2_URL}/auth/exchange`, {
            method: 'POST',
            headers: this.buildHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw { response: { status: response.status }, data: error };
        }

        const result = await response.json();
        const data = result.data || result;

        // 액세스 토큰을 메모리에 저장 (httpOnly 쿠키로 refreshToken은 자동 설정됨)
        if (data.access_token) {
            this._accessToken = data.access_token;
        }

        return data;
    }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();
