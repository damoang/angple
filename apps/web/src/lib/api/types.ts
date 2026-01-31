// API 응답 타입
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

// 페이지네이션 응답
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// 자유게시판 게시글 타입
export interface FreePost {
    id: number;
    title: string;
    content: string;
    author: string;
    author_id: string;
    views: number;
    likes: number;
    comments_count: number;
    created_at: string;
    updated_at?: string;
    has_file?: boolean;
    category?: string; // 게시글 카테고리 (예: "일상", "음식", "맛집")
    tags?: string[];
    images?: string[];
    is_secret?: boolean; // 비밀글 여부
    is_notice?: boolean; // 공지사항 여부
    notice_type?: 'normal' | 'important'; // 공지 타입 (일반/필수)
    is_adult?: boolean; // 19금 콘텐츠 여부
    thumbnail?: string; // 썸네일 URL
}

// 자유게시판 댓글 타입
export interface FreeComment {
    id: number | string; // v2 API는 number, v1은 string
    content: string;
    author: string;
    author_id: string;
    likes?: number;
    dislikes?: number; // 비추천 수
    depth?: number;
    parent_id: number | string; // v2 API는 number, v1은 string
    created_at: string;
    updated_at?: string;
    images?: string[];
    is_secret?: boolean; // 비밀댓글 여부
}

// API 키 등록 요청/응답
export interface RegisterApiKeyRequest {
    name: string;
    email: string;
}

export interface ApiKeyResponse {
    id: string;
    name: string;
    email: string;
    token: string;
    expires_at: string;
}

// 토큰 재발급 요청
export interface RefreshTokenRequest {
    email: string;
}

// API 에러
export interface ApiError {
    success: false;
    error: string;
    code?: string;
}

// 추천 글 타입
export type RecommendedPeriod = '1h' | '3h' | '6h' | '12h' | '24h' | '48h';

export interface RecommendedPost {
    id: number;
    title: string;
    board: string;
    board_name: string;
    url: string;
    recommend_count: number;
    comment_count: number;
    view_count: number;
    author: string;
    created_at: string;
}

export interface RecommendedSection {
    id: string;
    name: string;
    group_id: string;
    count: number;
    posts: RecommendedPost[] | null;
}

export interface RecommendedData {
    generated_at: string;
    period: string;
    period_hours: number;
    sections: {
        community: RecommendedSection;
        group: RecommendedSection;
        info: RecommendedSection;
    };
}

export interface AIKeyword {
    name: string;
    strength: number;
}

export interface AIAnalysis {
    period: string;
    trend_score: number;
    trend_summary: {
        headline: string[];
        reasons: string;
    };
    ambient_whisper: string[];
    analysis_commentary: string[];
    keywords: AIKeyword[];
    analysis_scope_text: string;
    friendly_update_time: string;
}

export interface RecommendedDataWithAI extends RecommendedData {
    ai_analysis?: AIAnalysis; // Optional - Gemini API 할당량 초과 시 없을 수 있음
}

// 새로운 소식 탭 타입
export type NewsTabId = 'new' | 'tip' | 'review' | 'notice';

export interface NewsPost {
    id: number;
    title: string;
    board: string;
    board_name: string;
    author: string;
    created_at: string;
    comment_count: number;
    view_count: number;
    recommend_count: number;
    url: string;
    is_notice: boolean;
    tab: NewsTabId;
}

// 경제 탭 타입
export type EconomyTabId = 'economy' | 'qa' | 'free' | 'angtt';

export interface EconomyPost {
    id: number;
    title: string;
    url: string;
    tab: EconomyTabId;
    author?: string;
}

export interface EconomyTabsData {
    economy: EconomyPost[];
    qa: EconomyPost[];
    free: EconomyPost[];
    angtt: EconomyPost[];
}

// 갤러리 타입
export interface GalleryPost {
    id: number;
    title: string;
    url: string;
    thumbnail_url?: string;
    author: string;
    comment_count: number;
    view_count: number;
    recommend_count: number;
    created_at: string;
}

// 소모임 탭 타입
export type GroupTabId = 'all' | '24h' | 'week' | 'month';

export interface GroupPost {
    id: number;
    title: string;
    url: string;
    recommend_count: number;
    author: string;
}

export interface GroupTabsData {
    all: GroupPost[];
    '24h': GroupPost[];
    week: GroupPost[];
    month: GroupPost[];
}

// 전체 위젯 데이터
export interface IndexWidgetsData {
    news_tabs: NewsPost[];
    economy_tabs: EconomyPost[];
    gallery: GalleryPost[];
    group_tabs: GroupTabsData;
}

// 사이드바 메뉴 타입
export interface MenuItem {
    id: number;
    parent_id?: number | null;
    title: string;
    url: string;
    icon?: string;
    shortcut?: string;
    description?: string;
    depth: number;
    order_num: number;
    target: string;
    show_in_header: boolean;
    show_in_sidebar: boolean;
    children?: MenuItem[];
}

// 사용자 타입 (damoang.net SSO)
export interface DamoangUser {
    mb_id: string;
    mb_name: string;
    mb_level: number;
    mb_email: string;
    mb_point?: number; // 보유 포인트
    mb_exp?: number; // 경험치
}

// 회원 프로필 타입 (공개 정보)
export interface MemberProfile {
    mb_id: string;
    mb_name: string;
    mb_level: number;
    mb_image?: string; // 프로필 이미지 URL
    mb_signature?: string; // 서명
    mb_homepage?: string; // 홈페이지
    mb_datetime: string; // 가입일
    mb_today_login?: string; // 최근 로그인
    post_count: number; // 작성 글 수
    comment_count: number; // 작성 댓글 수
}

// 내 활동 내역 타입
export interface MyActivity {
    posts: FreePost[];
    comments: MyComment[];
    liked_posts: FreePost[];
}

// 내가 작성한 댓글 (게시글 정보 포함)
export interface MyComment extends FreeComment {
    post_id: number;
    post_title: string;
    board_id: string;
}

// 차단 회원 정보
export interface BlockedMember {
    mb_id: string;
    mb_name: string;
    blocked_at: string;
}

// 게시글 작성 요청
export interface CreatePostRequest {
    title: string; // 필수, 1-200자
    content: string; // 필수, 1자 이상
    category?: string; // 선택
    author: string; // 필수, 1-50자
    password?: string; // 선택 (비회원 글 비밀번호)
    is_secret?: boolean; // 선택 (비밀글)
}

// 게시글 수정 요청
export interface UpdatePostRequest {
    title?: string; // 선택, 1-200자
    content?: string; // 선택, 1자 이상
    category?: string; // 선택
}

// 댓글 작성 요청
export interface CreateCommentRequest {
    content: string; // 필수, 1자 이상
    author: string; // 필수, 1-50자
    parent_id?: number | string; // 대댓글인 경우 부모 댓글 ID
    is_secret?: boolean; // 선택 (비밀댓글)
}

// 댓글 수정 요청
export interface UpdateCommentRequest {
    content: string; // 필수, 1자 이상
}

// 추천/비추천 응답
export interface LikeResponse {
    likes: number; // 현재 추천 수
    dislikes?: number; // 현재 비추천 수
    user_liked: boolean; // 현재 사용자가 추천했는지
    user_disliked?: boolean; // 현재 사용자가 비추천했는지
}

// 추천자 목록 응답
export interface LikerInfo {
    mb_id: string;
    mb_name: string;
    liked_at: string;
}

export interface LikersResponse {
    likers: LikerInfo[];
    total: number;
}

// 검색 필드 타입
export type SearchField = 'title' | 'content' | 'title_content' | 'author';

// 검색 요청 파라미터
export interface SearchParams {
    query: string; // 검색어 (stx)
    field: SearchField; // 검색 필드 (sfl)
    page?: number;
    limit?: number;
}

// 전체 검색 결과 타입 (게시판별 그룹핑)
export interface GlobalSearchResult {
    board_id: string;
    board_name: string;
    posts: FreePost[];
    total: number;
}

export interface GlobalSearchResponse {
    results: GlobalSearchResult[];
    total: number; // 전체 검색 결과 수
    query: string;
}

// 게시판 표시 설정
export interface BoardDisplaySettings {
    list_style: 'compact' | 'card' | 'detailed';
    show_preview: boolean;
    preview_length: number;
    show_thumbnail: boolean;
}

// 게시판 타입
export interface Board {
    board_id: string;
    group_id: string;
    subject: string;
    admin: string;
    device: string;
    list_level: number;
    read_level: number;
    write_level: number;
    reply_level: number;
    comment_level: number;
    use_category: number;
    use_good: number; // 추천 사용 여부 (0: 미사용, 1: 사용)
    use_nogood: number; // 비추천 사용 여부 (0: 미사용, 1: 사용)
    category_list: string;
    skin: string;
    mobile_skin: string;
    page_rows: number;
    upload_count: number;
    upload_size: number;
    count_write: number;
    count_comment: number;
    insert_time: string;
    display_settings: BoardDisplaySettings;
}

// 파일 업로드 관련 타입
export interface UploadedFile {
    id: string;
    filename: string;
    original_filename: string;
    url: string;
    thumbnail_url?: string;
    size: number;
    mime_type: string;
    created_at: string;
}

// Presigned URL 응답
export interface PresignedUrlResponse {
    upload_url: string;
    file_url: string;
    expires_at: string;
}

// 파일 업로드 요청
export interface UploadFileRequest {
    board_id: string;
    post_id?: number;
    file_type: 'image' | 'file';
}

// 첨부파일 정보 (게시글에 포함)
export interface PostAttachment {
    id: string;
    filename: string;
    original_filename: string;
    url: string;
    thumbnail_url?: string;
    size: number;
    mime_type: string;
    download_count: number;
}

// 신고 관련 타입
export type ReportTargetType = 'post' | 'comment';

// 신고 사유 (ang-gnu nariya 플러그인과 동일한 순서)
export type ReportReason =
    | 1 // 회원비하
    | 2 // 예의없음
    | 3 // 부적절한 표현
    | 4 // 차별행위
    | 5 // 분란유도
    | 6 // 여론조성
    | 7 // 회원기만
    | 8 // 이용방해
    | 9 // 용도위반
    | 10 // 거래금지위반
    | 11 // 구걸
    | 12 // 권리침해
    | 13 // 외설
    | 14 // 위법행위
    | 15; // 광고홍보

export interface ReportReasonInfo {
    value: ReportReason;
    label: string;
}

export interface CreateReportRequest {
    target_type: ReportTargetType;
    target_id: number | string;
    reason: ReportReason;
    detail?: string; // 기타 사유 상세 설명
}

export interface Report {
    id: string;
    target_type: ReportTargetType;
    target_id: number | string;
    reason: ReportReason;
    detail?: string;
    reporter_id: string;
    reporter_name: string;
    status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
    created_at: string;
    reviewed_at?: string;
}

// 포인트 관련 타입
export interface PointHistory {
    id: number;
    mb_id: string;
    po_content: string; // 포인트 내역 설명
    po_point: number; // 포인트 금액 (양수: 적립, 음수: 사용)
    po_datetime: string; // 발생 시간
    po_expired: boolean; // 만료 여부
    po_expire_date: string; // 만료일
    po_rel_table?: string; // 관련 테이블 (예: 게시판)
    po_rel_id?: string; // 관련 ID
    po_rel_action?: string; // 관련 액션 (예: 글쓰기, 댓글)
}

export interface PointSummary {
    total_point: number; // 현재 보유 포인트
    total_earned: number; // 총 적립 포인트
    total_used: number; // 총 사용 포인트
}

export interface PointHistoryResponse {
    summary: PointSummary;
    items: PointHistory[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// 알림 관련 타입
export type NotificationType =
    | 'comment' // 내 글에 댓글
    | 'reply' // 내 댓글에 답글
    | 'mention' // @멘션
    | 'like' // 추천
    | 'message' // 쪽지
    | 'system'; // 시스템 알림

export interface Notification {
    id: number;
    type: NotificationType;
    title: string;
    content: string;
    url?: string; // 클릭 시 이동할 URL
    sender_id?: string; // 발신자 ID
    sender_name?: string; // 발신자 이름
    is_read: boolean;
    created_at: string;
}

export interface NotificationSummary {
    total_unread: number; // 읽지 않은 알림 수
}

export interface NotificationListResponse {
    items: Notification[];
    total: number;
    unread_count: number;
    page: number;
    limit: number;
    total_pages: number;
}

// 쪽지 관련 타입
export type MessageKind = 'recv' | 'send'; // 받은쪽지 / 보낸쪽지

export interface Message {
    id: number;
    sender_id: string;
    sender_name: string;
    receiver_id: string;
    receiver_name: string;
    content: string;
    is_read: boolean;
    read_datetime?: string;
    send_datetime: string;
}

export interface MessageListResponse {
    items: Message[];
    total: number;
    unread_count: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface SendMessageRequest {
    receiver_id: string;
    content: string;
}

// 경험치 관련 타입
export interface ExpHistory {
    id: number;
    mb_id: string;
    exp_content: string; // 경험치 내역 설명
    exp_point: number; // 경험치 (양수: 획득, 음수: 차감)
    exp_datetime: string;
    exp_rel_table?: string;
    exp_rel_id?: string;
    exp_rel_action?: string;
}

export interface ExpSummary {
    total_exp: number; // 현재 경험치
    current_level: number; // 현재 레벨
    next_level_exp: number; // 다음 레벨까지 필요한 경험치
    level_progress: number; // 레벨 진행률 (0-100)
}

export interface ExpHistoryResponse {
    summary: ExpSummary;
    items: ExpHistory[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// ==================== 인증 관련 타입 ====================

// 로그인 요청
export interface LoginRequest {
    user_id: string; // 아이디
    password: string; // 비밀번호
    remember?: boolean; // 로그인 유지
}

// 로그인 응답
export interface LoginResponse {
    access_token: string;
    refresh_token?: string; // httpOnly 쿠키로 설정될 수도 있음
    expires_in: number; // 토큰 만료 시간 (초)
    token_type: string; // 'Bearer'
    user: DamoangUser;
}

// OAuth 제공자 타입
export type OAuthProvider =
    | 'google'
    | 'kakao'
    | 'naver'
    | 'apple'
    | 'facebook'
    | 'twitter'
    | 'payco';

// OAuth 로그인 요청
export interface OAuthLoginRequest {
    provider: OAuthProvider;
    code: string; // OAuth 인증 코드
    redirect_uri: string;
}

// 회원가입 요청
export interface RegisterRequest {
    mb_id: string;
    mb_password: string;
    mb_password_confirm: string;
    mb_name: string;
    mb_nick: string;
    mb_email: string;
    agree_terms: boolean;
    agree_privacy: boolean;
}

// 회원가입 응답
export interface RegisterResponse {
    success: boolean;
    message: string;
    user?: DamoangUser;
}
