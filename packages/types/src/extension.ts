/**
 * @angple/types - Extension System Types
 *
 * ZeroPress 철학 반영:
 * - 플러그인 지옥 없음 → 완전 격리된 Extension
 * - 타입 안전성 → TypeScript strict mode
 * - Zero-Config → 설치 즉시 작동
 */

/**
 * Extension 대분류
 *
 * 하이브리드 2.0 아키텍처:
 * - 1단계: category로 테마와 플러그인 명확히 구분
 * - 2단계: pluginType으로 플러그인 세부 분류
 * - 3단계: tags로 유연한 검색 지원
 */
export type ExtensionCategory = 'theme' | 'plugin';

/**
 * 플러그인 세부 분류
 *
 * WordPress의 단순한 "플러그인"과 달리,
 * 플러그인은 명확한 기능별 역할과 범위를 가짐
 */
export enum PluginType {
    /** 게시판 기능 확장 (추천/비추천, 익명 게시, 신고 시스템 등) */
    BOARD = 'board',

    /** 에디터 확장 (마크다운, WYSIWYG, AI 글쓰기, 코드 하이라이팅 등) */
    EDITOR = 'editor',

    /** 인증/보안 확장 (OAuth, 2FA, reCAPTCHA, 스팸 필터 등) */
    AUTH = 'auth',

    /** SEO/마케팅 확장 (메타태그, 사이트맵, Analytics, OG 이미지 등) */
    SEO = 'seo',

    /** 미디어 확장 (이미지 최적화, 동영상 임베드, 갤러리 등) */
    MEDIA = 'media',

    /** 소셜 기능 (공유, 좋아요, 팔로우, 멘션 등) */
    SOCIAL = 'social',

    /** 알림/메시징 (푸시, 이메일, 슬랙 연동, 디스코드 봇 등) */
    NOTIFICATION = 'notification',

    /** 분석/통계 (방문자 추적, 대시보드, 리포트 등) */
    ANALYTICS = 'analytics',

    /** 결제/커머스 (정기구독, 포인트, 후원 등) */
    PAYMENT = 'payment',

    /** AI 통합 (GPT, Claude, 번역, 요약, 감정 분석 등) */
    AI = 'ai',

    /** 커스텀 (기타) */
    CUSTOM = 'custom'
}

/**
 * @deprecated ExtensionType은 PluginType으로 이름 변경되었습니다. PluginType을 사용하세요.
 */
export const ExtensionType = PluginType;

/**
 * Extension 권한 시스템
 *
 * WordPress의 보안 취약점 해결:
 * - 명시적 권한 요청 (사용자가 승인해야 작동)
 * - 최소 권한 원칙 (필요한 권한만 요청)
 */
export enum ExtensionPermission {
    // 게시글 관련
    'posts:read' = 'posts:read',
    'posts:write' = 'posts:write',
    'posts:delete' = 'posts:delete',

    // 댓글 관련
    'comments:read' = 'comments:read',
    'comments:write' = 'comments:write',
    'comments:delete' = 'comments:delete',

    // 사용자 관련
    'users:read' = 'users:read',
    'users:write' = 'users:write',
    'users:delete' = 'users:delete',

    // 설정 관련
    'settings:read' = 'settings:read',
    'settings:write' = 'settings:write',

    // 파일 시스템
    'files:read' = 'files:read',
    'files:write' = 'files:write',
    'files:delete' = 'files:delete',

    // 외부 API
    'api:external' = 'api:external',

    // 데이터베이스 (고급 권한)
    'database:read' = 'database:read',
    'database:write' = 'database:write',

    // 네트워크
    'network:fetch' = 'network:fetch',
    'network:websocket' = 'network:websocket'
}

/**
 * Extension 작성자 정보
 */
export interface ExtensionAuthor {
    /** 작성자 이름 */
    name: string;

    /** 이메일 (선택) */
    email?: string;

    /** 웹사이트 URL (선택) */
    url?: string;

    /** GitHub 사용자명 (선택) */
    github?: string;
}

/**
 * Extension 저장소 정보
 */
export interface ExtensionRepository {
    /** 저장소 타입 (git, svn 등) */
    type: 'git' | 'svn' | 'mercurial';

    /** 저장소 URL */
    url: string;

    /** 디렉터리 (monorepo의 경우) */
    directory?: string;
}

/**
 * Extension 설정 필드 타입
 */
export type ExtensionSettingType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'textarea'
    | 'email'
    | 'url'
    | 'color'
    | 'date'
    | 'time'
    | 'datetime';

/**
 * Extension 설정 필드 정의
 */
export interface ExtensionSettingField {
    /** 필드 타입 */
    type: ExtensionSettingType;

    /** 라벨 (UI 표시용) */
    label: string;

    /** 설명 */
    description?: string;

    /** 기본값 */
    default?: unknown;

    /** 필수 여부 */
    required?: boolean;

    /** 비밀 정보 여부 (API 키 등) */
    secret?: boolean;

    /** 옵션 (select, multiselect용) */
    options?: string[] | { label: string; value: string }[];

    /** 최소값 (number용) */
    min?: number;

    /** 최대값 (number용) */
    max?: number;

    /** 패턴 (정규식 검증) */
    pattern?: string;

    /** 플레이스홀더 */
    placeholder?: string;
}

/**
 * Extension Hook 정의
 */
export interface ExtensionHook {
    /** Hook 이름 */
    name: string;

    /** Hook 핸들러 파일 경로 */
    handler: string;

    /** 우선순위 (낮을수록 먼저 실행) */
    priority?: number;
}

/**
 * Extension REST API 라우트 정의
 */
export interface ExtensionAPIRoute {
    /** HTTP 메서드 */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

    /** 경로 (prefix 제외) */
    path: string;

    /** 핸들러 파일 경로 */
    handler: string;

    /** 필요한 권한 */
    permissions?: ExtensionPermission[];

    /** 인증 필요 여부 */
    authenticated?: boolean;

    /** Rate Limiting (요청/분) */
    rateLimit?: number;
}

/**
 * Extension REST API 설정
 */
export interface ExtensionRESTAPI {
    /** API prefix (예: /ai-assistant) */
    prefix: string;

    /** API 라우트 목록 */
    routes: ExtensionAPIRoute[];
}

/**
 * Extension GraphQL API 설정
 */
export interface ExtensionGraphQLAPI {
    /** GraphQL 스키마 파일 경로 */
    schema: string;

    /** Resolver 파일 경로 */
    resolvers: string;
}

/**
 * Extension API 설정
 */
export interface ExtensionAPI {
    /** REST API */
    rest?: ExtensionRESTAPI;

    /** GraphQL API */
    graphql?: ExtensionGraphQLAPI;
}

/**
 * Extension Admin UI 메뉴 설정
 */
export interface ExtensionAdminMenu {
    /** 메뉴 제목 */
    title: string;

    /** 아이콘 (Lucide 아이콘 이름) */
    icon?: string;

    /** 메뉴 위치 (낮을수록 위) */
    position?: number;

    /** Svelte 컴포넌트 경로 */
    component: string;
}

/**
 * Extension Admin UI 설정
 */
export interface ExtensionAdminUI {
    /** 메뉴 */
    menu?: ExtensionAdminMenu;

    /** 설정 페이지 */
    settings?: {
        component: string;
    };
}

/**
 * Extension Editor UI 설정
 */
export interface ExtensionEditorUI {
    /** 에디터 툴바 */
    toolbar?: {
        component: string;
    };

    /** 사이드바 */
    sidebar?: {
        component: string;
    };
}

/**
 * Extension UI 설정
 */
export interface ExtensionUI {
    /** Admin UI */
    admin?: ExtensionAdminUI;

    /** Editor UI */
    editor?: ExtensionEditorUI;
}

/**
 * Extension 엔진 요구사항
 */
export interface ExtensionEngines {
    /** Node.js 버전 */
    node?: string;

    /** SvelteKit 버전 */
    sveltekit?: string;

    /** Angple 버전 */
    angple?: string;
}

/**
 * Extension Manifest (extension.json)
 *
 * WordPress의 plugin.php 헤더와 달리,
 * TypeScript로 타입 검증 가능한 JSON 매니페스트
 *
 * 하이브리드 2.0 아키텍처:
 * - category: 'theme' | 'plugin' (필수, 명확한 구분)
 * - pluginType: PluginType enum (선택, 플러그인 세부 분류)
 * - tags: string[] (선택, 유연한 검색)
 */
export interface ExtensionManifest {
    /** Extension ID (kebab-case, 영문자/숫자/하이픈만) */
    id: string;

    /** Extension 이름 */
    name: string;

    /** 버전 (semver) */
    version: string;

    /** 설명 */
    description: string;

    /** 작성자 정보 */
    author: ExtensionAuthor;

    /** 라이선스 */
    license: string;

    /** Extension 대분류 (테마 또는 플러그인) */
    category: ExtensionCategory;

    /** 플러그인 세부 분류 (pluginType은 category가 'plugin'일 때만 사용) */
    pluginType?: PluginType;

    /** 검색용 태그 (AI 분석, 자동 완성 등에 활용) */
    tags?: string[];

    /** 키워드 (검색용, tags와 병행 사용 가능) */
    keywords?: string[];

    /** Angple 최소 버전 */
    angpleVersion?: string;

    /** 엔진 요구사항 */
    engines?: ExtensionEngines;

    /** Entry Point (TypeScript 컴파일 결과) */
    main: string;

    /** TypeScript 타입 정의 */
    types?: string;

    /** 필요한 권한 목록 */
    permissions?: ExtensionPermission[];

    /** Hook 등록 */
    hooks?: Record<string, string>;

    /** API 설정 */
    api?: ExtensionAPI;

    /** UI 설정 */
    ui?: ExtensionUI;

    /** Extension 설정 필드 */
    settings?: Record<string, ExtensionSettingField>;

    /** npm 의존성 (package.json처럼) */
    dependencies?: Record<string, string>;

    /** 개발 의존성 */
    devDependencies?: Record<string, string>;

    /** 홈페이지 URL */
    homepage?: string;

    /** 저장소 정보 */
    repository?: ExtensionRepository;

    /** 버그 리포트 URL */
    bugs?: string;

    /** 스크린샷 파일 경로 */
    screenshot?: string;

    /** README 파일 경로 */
    readme?: string;

    /** 변경 로그 파일 경로 */
    changelog?: string;

    /** 가격 (0 = 무료) */
    price?: number;

    /** 다운로드 수 (Marketplace용) */
    downloads?: number;

    /** 평점 (1-5) */
    rating?: number;

    /** 마지막 업데이트 날짜 */
    updatedAt?: string;

    /** 생성 날짜 */
    createdAt?: string;

    /** 활성화 여부 */
    active?: boolean;

    /** 커스텀 Extension 여부 (사용자 업로드) */
    isCustom?: boolean;
}

/**
 * Extension 상태
 */
export enum ExtensionStatus {
    /** 설치되지 않음 */
    NOT_INSTALLED = 'not_installed',

    /** 설치됨 (비활성화) */
    INSTALLED = 'installed',

    /** 활성화됨 */
    ACTIVE = 'active',

    /** 업데이트 가능 */
    UPDATE_AVAILABLE = 'update_available',

    /** 오류 */
    ERROR = 'error',

    /** 호환성 문제 */
    INCOMPATIBLE = 'incompatible'
}

/**
 * Extension 런타임 정보
 */
export interface ExtensionRuntime {
    /** Extension ID */
    id: string;

    /** 현재 상태 */
    status: ExtensionStatus;

    /** 활성화 여부 */
    active: boolean;

    /** 로드 시간 (ms) */
    loadTime?: number;

    /** 에러 메시지 */
    error?: string;

    /** 사용 중인 메모리 (bytes) */
    memoryUsage?: number;

    /** API 호출 횟수 */
    apiCalls?: number;
}

/**
 * Extension 설치 옵션
 */
export interface ExtensionInstallOptions {
    /** 설치 후 즉시 활성화 */
    activate?: boolean;

    /** 의존성 자동 설치 */
    installDependencies?: boolean;

    /** 기존 Extension 덮어쓰기 */
    overwrite?: boolean;
}

/**
 * Extension 검색 필터
 */
export interface ExtensionSearchFilter {
    /** 검색 쿼리 */
    query?: string;

    /** Extension 대분류 (theme/plugin) */
    category?: ExtensionCategory;

    /** 플러그인 세부 분류 (category가 'plugin'일 때만 유효) */
    pluginType?: PluginType;

    /** 태그 검색 */
    tags?: string[];

    /** 최소 평점 */
    minRating?: number;

    /** 가격 (0 = 무료만) */
    price?: 'free' | 'paid' | 'all';

    /** 정렬 */
    sort?: 'popular' | 'rating' | 'recent' | 'name';

    /** 페이지 번호 */
    page?: number;

    /** 페이지 크기 */
    pageSize?: number;
}
