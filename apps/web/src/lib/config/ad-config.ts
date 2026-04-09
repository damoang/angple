/**
 * GAM (Google Ad Manager) 광고 설정
 *
 * 모든 광고 단위 경로, 사이즈, 위치 매핑을 환경변수 기반으로 관리합니다.
 * .env에서 VITE_GAM_* 변수를 설정하세요.
 */

// 환경변수 기반 GAM 설정
export const GAM_NETWORK_CODE = import.meta.env.VITE_GAM_NETWORK_CODE || '';
export const GAM_SITE_NAME = import.meta.env.VITE_GAM_SITE_NAME || 'default';
// Ad Manager UI의 refresh declaration과 동일하게 맞춰야 합니다.
// 기본값은 30초이며, 실제 운영값도 env와 Ad Manager 설정을 함께 맞춰야 합니다.
export const GAM_AD_REFRESH_INTERVAL = Number(import.meta.env.VITE_GAM_AD_REFRESH_INTERVAL || 30); // 초
export const GAM_AD_EMPTY_RETRY_DELAY = 30; // 초

// 위치별 refresh 간격 (초) — viewability 기반 차등화
// 기본값(GAM_AD_REFRESH_INTERVAL)을 override
export const POSITION_REFRESH_INTERVALS: Record<string, number> = {
    'sidebar-sticky-desktop': 30,
    sidebar: 30,
    'wing-left': 30,
    'wing-right': 30,
    'board-list-infeed': 40,
    'comment-infeed': 40,
    'index-middle-1': 45,
    'index-middle-2': 45,
    'index-bottom': 45
};

// GAM 빈 슬롯 → 카카오 애드핏 폴백 설정
export const ADFIT_FALLBACK_MAX_RETRIES = 2; // GAM 재시도 횟수 (2회 후 애드핏 전환)

export type AdfitUnit = { unitId: string; width: number; height: number };
export type AdfitFallback = { desktop: AdfitUnit; mobile: AdfitUnit };

const ADFIT = {
    desktop_banner: { unitId: 'DAN-9qdD2GVgW3AXbClR', width: 728, height: 90 },
    mobile_banner: { unitId: 'DAN-ry6MhSvNcdUCMwtP', width: 320, height: 100 },
    mobile_small: { unitId: 'DAN-NPSIJ0trXOPAXpuM', width: 320, height: 50 },
    medium_rect: { unitId: 'DAN-eAXFNdHYsuiUQoFs', width: 300, height: 250 },
    square: { unitId: 'DAN-cVaSnUSwfqmUnOAH', width: 250, height: 250 },
    skyscraper: { unitId: 'DAN-LXOsjqjRz52xL3Ti', width: 160, height: 600 }
} as const;

// GAM position → 애드핏 폴백 유닛 매핑
export const ADFIT_FALLBACK_MAP: Record<string, AdfitFallback> = {
    'board-content': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_banner },
    'board-before-comments': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_banner },
    'board-list-bottom': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_banner },
    'board-list-infeed': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_small },
    'comment-infeed': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_small },
    'index-top': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_banner },
    'index-middle-1': { desktop: ADFIT.desktop_banner, mobile: ADFIT.mobile_banner },
    'sidebar-sticky-desktop': { desktop: ADFIT.medium_rect, mobile: ADFIT.medium_rect },
    sidebar: { desktop: ADFIT.medium_rect, mobile: ADFIT.medium_rect },
    'wing-left': { desktop: ADFIT.skyscraper, mobile: ADFIT.skyscraper },
    'wing-right': { desktop: ADFIT.skyscraper, mobile: ADFIT.skyscraper }
};

// 광고 단위 경로 (환경변수로 커스터마이징 가능)
const unitMain = import.meta.env.VITE_GAM_UNIT_MAIN || 'banner-responsive_main';
const unitSub = import.meta.env.VITE_GAM_UNIT_SUB || 'banner-responsive_sub';
const unitCuration = import.meta.env.VITE_GAM_UNIT_CURATION || 'banner-responsive_curation';
const unitArticle = import.meta.env.VITE_GAM_UNIT_ARTICLE || 'banner-responsive_article';
const unitWing = import.meta.env.VITE_GAM_UNIT_WING || 'banner-responsive_wing';

export const AD_UNIT_PATHS: Record<string, string> = {
    main: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/${unitMain}`,
    sub: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/${unitSub}`,
    curation: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/${unitCuration}`,
    article: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/${unitArticle}`,
    wing: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/${unitWing}`
};

// 광고 유형별 설정
export type AdConfig = {
    unit: string;
    sizes: Array<[number, number]>;
    responsive: Array<[number, Array<[number, number]>]> | null;
};

export const AD_CONFIGS: Record<string, AdConfig> = {
    'banner-horizontal': {
        unit: AD_UNIT_PATHS.main,
        sizes: [
            [970, 250],
            [970, 90],
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [
                970,
                [
                    [970, 250],
                    [970, 90],
                    [728, 90]
                ]
            ],
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-large': {
        unit: AD_UNIT_PATHS.main,
        sizes: [
            [970, 250],
            [970, 90],
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [
                970,
                [
                    [970, 250],
                    [970, 90]
                ]
            ],
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-article': {
        unit: AD_UNIT_PATHS.article,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-view-content': {
        unit: AD_UNIT_PATHS.article,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-responsive': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-small': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-compact': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-square': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [[300, 250]],
        responsive: null
    },
    'banner-square-small': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [[320, 100]],
        responsive: null
    },
    'banner-halfpage': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [300, 600],
            [300, 250]
        ],
        responsive: [
            [1280, [[300, 600]]],
            [0, [[300, 250]]]
        ]
    },
    'banner-medium': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-medium-compact': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-header-center': {
        unit: AD_UNIT_PATHS.sub,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [1280, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-large-compact': {
        unit: AD_UNIT_PATHS.main,
        sizes: [
            [970, 250],
            [970, 90],
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [
                970,
                [
                    [970, 250],
                    [970, 90]
                ]
            ],
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-large-728': {
        unit: AD_UNIT_PATHS.main,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-horizontal-728': {
        unit: AD_UNIT_PATHS.article,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    infeed: {
        unit: AD_UNIT_PATHS.curation,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'infeed-compact': {
        unit: AD_UNIT_PATHS.curation,
        sizes: [
            [728, 90],
            [320, 100]
        ],
        responsive: [
            [728, [[728, 90]]],
            [0, [[320, 100]]]
        ]
    },
    'banner-vertical': {
        unit: AD_UNIT_PATHS.wing,
        sizes: [[160, 600]],
        responsive: null
    }
};

// 사이트 위치 → 광고 유형 매핑
// 유닛 분산: main(대형), sub(중소형), article(본문), curation(인피드)
export const POSITION_MAP: Record<string, string> = {
    // 게시판 상단/하단 — main 유닛 (대형)
    'board-head': 'banner-horizontal',
    'board-list-head': 'banner-medium-compact',
    'board-list-bottom': 'banner-large-compact',
    'board-footer': 'banner-compact',
    'header-after': 'banner-header-center',

    // 본문 영역 — article 유닛 (본문 전용)
    'board-content': 'banner-article',
    'board-content-bottom': 'banner-view-content',
    'board-before-comments': 'banner-article',

    // 인피드 — curation 유닛
    'board-list-infeed': 'infeed-compact',
    'comment-infeed': 'infeed-compact',
    'comment-top': 'banner-compact',

    // 큐레이션 페이지 — 전용 문맥 슬롯
    'feed-top': 'banner-article',
    'groups-top': 'banner-article',
    'explore-top': 'banner-article',
    'explore-bottom': 'banner-horizontal-728',
    'empathy-top': 'banner-article',
    'empathy-bottom': 'banner-horizontal-728',

    // 인덱스(홈) — main 유닛
    'index-head': 'banner-small',
    'index-top': 'banner-responsive',
    'index-news-economy': 'banner-responsive',
    'index-middle-1': 'banner-medium-compact',
    'index-middle-2': 'banner-medium-compact',
    'index-bottom': 'banner-large',

    // 사이드바 — sub 유닛 (소형)
    'sidebar-sticky': 'banner-halfpage',
    'sidebar-sticky-desktop': 'banner-halfpage',
    sidebar: 'banner-square',
    'sidebar-drawer': 'banner-square-small',
    'sidebar-1': 'banner-square',
    'sidebar-b2b': 'banner-square',

    // 윙 배너 — sub 유닛
    'wing-left': 'banner-vertical',
    'wing-right': 'banner-vertical'
};

// 위치별 라벨 매핑
export const POSITION_LABELS: Record<string, string> = {
    'header-after': '메뉴 하단',
    'index-head': '상단 광고',
    'index-top': '공감글 하단 광고',
    'index-news-economy': '소식/구매 사이',
    'index-middle-1': '중간 광고 1',
    'index-middle-2': '중간 광고 2',
    'index-bottom': '하단 광고',
    'side-banner': '사이드 배너',
    'board-head': '게시판 상단',
    'board-list-head': '목록 상단',
    'board-list-bottom': '목록 하단',
    'board-content': '본문 광고',
    'board-content-bottom': '본문 하단',
    'board-before-comments': '댓글 상단',
    'board-footer': '게시판 하단',
    'board-list-infeed': '목록 인피드',
    'comment-infeed': '댓글 인피드',
    'feed-top': '새글모음 상단',
    'groups-top': '소모임 상단',
    'sidebar-sticky': '사이드바 고정',
    'sidebar-sticky-desktop': '사이드바 고정 (PC)',
    'sidebar-b2b': 'B2B 광고',
    'wing-left': '왼쪽 윙 배너',
    'wing-right': '오른쪽 윙 배너'
};
