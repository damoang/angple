/**
 * Canonical URL 유틸리티
 *
 * URL 파라미터 기반으로 canonical URL을 생성하여
 * 페이지네이션/필터/정렬 페이지의 SEO를 최적화합니다.
 */

/** 필터/페이지네이션으로 간주되어 canonical URL에서 제거될 파라미터 */
const FILTER_PARAMS = ['page', 'sst', 'sod', 'sfl', 'stx', 'sca', 'sop', 'spt', 'limit'] as const;

/** 검색으로 간주되는 파라미터 (noindex 적용) */
const SEARCH_PARAMS = ['stx', 'q', 'sfl'] as const;

/**
 * URL에서 canonical URL을 생성합니다.
 * 페이지네이션/필터/정렬 파라미터가 있으면 기본 URL을 반환합니다.
 *
 * @param url - 현재 URL
 * @param baseOrigin - 사이트 origin (예: https://damoang.net)
 * @returns canonical URL 문자열
 */
export function getCanonicalUrl(url: URL, baseOrigin?: string): string {
    const origin = baseOrigin || url.origin;
    const hasFilterParams = FILTER_PARAMS.some((p) => url.searchParams.has(p));

    if (hasFilterParams) {
        // 필터/페이지네이션은 기본 경로를 canonical로
        return `${origin}${url.pathname}`;
    }

    return `${origin}${url.pathname}${url.search}`;
}

/**
 * URL이 검색 결과 페이지인지 확인합니다.
 * 검색 페이지는 noindex 처리됩니다.
 */
export function isSearchPage(url: URL): boolean {
    return SEARCH_PARAMS.some(
        (p) => url.searchParams.has(p) && url.searchParams.get(p)?.trim() !== ''
    );
}

/**
 * URL이 페이지네이션 페이지인지 확인합니다 (2페이지 이상).
 */
export function isPaginatedPage(url: URL): boolean {
    const page = Number(url.searchParams.get('page')) || 1;
    return page > 1;
}

/**
 * URL이 필터/정렬이 적용된 페이지인지 확인합니다.
 */
export function hasFilterParams(url: URL): boolean {
    return FILTER_PARAMS.some((p) => url.searchParams.has(p));
}

/**
 * 페이지네이션 SEO 메타데이터를 생성합니다.
 *
 * @param currentPage - 현재 페이지 번호
 * @param totalPages - 전체 페이지 수
 * @param baseUrl - 기본 URL (파라미터 제외)
 * @returns 페이지네이션 SEO 설정
 */
export function getPaginationSeo(
    currentPage: number,
    totalPages: number,
    baseUrl: string
): {
    canonical: string;
    prev: string | null;
    next: string | null;
    robots: string;
} {
    return {
        // 항상 첫 페이지를 canonical로 지정
        canonical: baseUrl,
        // 이전/다음 페이지 링크
        prev: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null,
        next: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null,
        // 페이지네이션은 index, follow (noindex 제거)
        robots: 'index, follow'
    };
}

/**
 * 페이지 SEO 설정을 결정합니다.
 *
 * @param url - 현재 URL
 * @param currentPage - 현재 페이지 번호
 * @param totalPages - 전체 페이지 수
 * @param baseOrigin - 사이트 origin
 * @returns SEO 설정 객체
 */
export function getPageSeoConfig(
    url: URL,
    currentPage: number,
    totalPages: number,
    baseOrigin?: string
): {
    canonical: string;
    prev: string | null;
    next: string | null;
    noIndex: boolean;
    noFollow: boolean;
} {
    const origin = baseOrigin || url.origin;
    const basePath = `${origin}${url.pathname}`;

    // 검색 결과 페이지는 noindex (thin content)
    if (isSearchPage(url)) {
        return {
            canonical: basePath,
            prev: null,
            next: null,
            noIndex: true,
            noFollow: false // follow는 유지하여 링크 크롤링 허용
        };
    }

    // 페이지네이션/필터 페이지
    if (isPaginatedPage(url) || hasFilterParams(url)) {
        const pagination = getPaginationSeo(currentPage, totalPages, basePath);
        return {
            canonical: pagination.canonical,
            prev: pagination.prev,
            next: pagination.next,
            noIndex: false, // noindex 제거 (canonical로 처리)
            noFollow: false
        };
    }

    // 일반 페이지
    return {
        canonical: `${origin}${url.pathname}${url.search}`,
        prev: null,
        next: null,
        noIndex: false,
        noFollow: false
    };
}
