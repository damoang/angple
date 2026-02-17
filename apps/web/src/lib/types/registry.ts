/**
 * 테마/플러그인 마켓플레이스 레지스트리 타입
 *
 * 외부 레지스트리(GitHub Pages JSON)에서 가져오는 테마 메타데이터를 정의합니다.
 * 로컬에 설치되지 않은 테마도 포함하여 마켓플레이스에서 검색/설치할 수 있습니다.
 */

/**
 * 레지스트리에 등록된 테마 정보
 */
export interface RegistryTheme {
    /** 테마 ID (theme.json의 id와 동일) */
    id: string;
    /** 표시 이름 */
    name: string;
    /** 설명 */
    description: string;
    /** 버전 */
    version: string;
    /** 작성자 */
    author: string;
    /** 태그 */
    tags: string[];
    /** 카테고리 (general, community, blog, business 등) */
    category: string;
    /** 스크린샷 URL (절대 경로) */
    screenshot?: string;
    /** 다운로드 수 */
    downloads: number;
    /** 평점 (0-5) */
    rating: number;

    // --- 배포 정보 ---

    /** 무료/프리미엄 구분 */
    tier: 'free' | 'premium';
    /** 가격 (0이면 무료) */
    price: number;
    /** GitHub 레포 URL */
    githubUrl: string;
    /** 모노레포 내 서브디렉토리 (예: "themes/damoang-basic") */
    githubPath?: string;
    /** 최소 Angple 버전 호환성 */
    minAngpleVersion?: string;

    // --- 프리미엄 전용 ---

    /** 필요한 GitHub token scope (예: "@damoang") */
    requiredScope?: string;
    /** 라이선스 키 필요 여부 */
    licenseRequired?: boolean;
    /** 라이선스 검증용 제품 ID */
    productId?: string;
}

/**
 * 레지스트리 전체 구조
 */
export interface ThemeRegistry {
    /** 레지스트리 포맷 버전 */
    version: number;
    /** 마지막 업데이트 (ISO 8601) */
    updatedAt: string;
    /** 등록된 테마 목록 */
    themes: RegistryTheme[];
}

/**
 * 마켓플레이스 설치 요청
 */
export interface MarketplaceInstallRequest {
    /** 설치할 테마 ID */
    themeId: string;
    /** 라이선스 키 (프리미엄 테마용) */
    licenseKey?: string;
}

/**
 * 마켓플레이스 설치 응답
 */
export interface MarketplaceInstallResponse {
    success: boolean;
    theme?: { id: string; name: string; version: string };
    error?: string;
    /** GitHub token이 필요하면 true */
    requiresAuth?: boolean;
    /** 라이선스 키가 필요하면 true */
    requiresLicense?: boolean;
}

/**
 * 마켓플레이스 테마 (로컬 + 레지스트리 병합 결과)
 */
export interface MarketplaceTheme {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    downloads: number;
    rating: number;
    tags: string[];
    category: string;
    price: number;
    screenshot?: string;
    /** 로컬에 설치되어 있는지 */
    installed: boolean;
    /** 현재 활성 테마인지 */
    isActive: boolean;
    /** 무료/프리미엄 */
    tier: 'free' | 'premium';
    /** GitHub 레포 URL */
    githubUrl?: string;
    /** 필요한 GitHub token scope */
    requiredScope?: string;
    /** 라이선스 필요 여부 */
    licenseRequired?: boolean;
}
