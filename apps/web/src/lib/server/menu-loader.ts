/**
 * 서버 사이드 메뉴 데이터 로더 (인메모리 캐시)
 *
 * Go 백엔드의 /api/v1/menus/sidebar를 SSR에서 호출하여 캐시합니다.
 * 클라이언트 사이드 API 호출을 제거하여 동접 1만명 환경에서의 부하를 줄입니다.
 */

import type { MenuItem } from '$lib/api/types';
import { env } from '$env/dynamic/private';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

let cachedMenus: MenuItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 300_000; // 5분 (메뉴는 거의 변경되지 않음)

/**
 * 백엔드 연결 불가 시 최소한의 기본 메뉴
 * Reddit/Facebook 패턴: 네비게이션은 항상 표시 (App Shell)
 */
const menuDefaults = {
    depth: 0,
    order_num: 0,
    target: '_self',
    show_in_header: false,
    show_in_sidebar: true
} as const;
const FALLBACK_MENUS: MenuItem[] = [
    {
        ...menuDefaults,
        id: 9001,
        title: '커뮤니티',
        url: '',
        icon: 'MessageSquare',
        children: [
            {
                ...menuDefaults,
                depth: 1,
                id: 9010,
                title: '자유게시판',
                url: '/free',
                icon: 'MessageSquare',
                children: []
            },
            {
                ...menuDefaults,
                depth: 1,
                id: 9011,
                title: '질문답변',
                url: '/qa',
                icon: 'CircleHelp',
                children: []
            },
            {
                ...menuDefaults,
                depth: 1,
                id: 9012,
                title: '알뜰구매',
                url: '/economy',
                icon: 'ShoppingCart',
                children: []
            },
            {
                ...menuDefaults,
                depth: 1,
                id: 9013,
                title: '정보공유',
                url: '/tips',
                icon: 'Lightbulb',
                children: []
            }
        ]
    },
    {
        ...menuDefaults,
        id: 9002,
        title: '갤러리',
        url: '/gallery',
        icon: 'Images',
        children: []
    }
];

/**
 * 메뉴 캐시 무효화 (관리자가 메뉴 변경 시 호출)
 */
export function invalidateMenuCache(): void {
    cachedMenus = null;
    cacheTimestamp = 0;
}

/**
 * 메뉴 데이터를 서버에서 로드 (5분 인메모리 캐시)
 */
export async function loadMenus(): Promise<MenuItem[]> {
    const now = Date.now();
    if (cachedMenus && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedMenus;
    }

    const backendUrl = BACKEND_URL;

    try {
        const response = await fetch(`${backendUrl}/api/v1/menus/sidebar`, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Angple-Web-SSR/1.0'
            },
            signal: AbortSignal.timeout(3_000)
        });

        if (!response.ok) {
            console.error('[menu-loader] API error:', response.status);
            return cachedMenus ?? FALLBACK_MENUS;
        }

        const result = await response.json();
        const menus: MenuItem[] = result.data ?? [];

        cachedMenus = menus;
        cacheTimestamp = now;

        return menus;
    } catch (err) {
        console.error('[menu-loader] fetch failed:', err);
        // 캐시가 있으면 만료되었더라도 반환 (graceful degradation)
        // 캐시도 없으면 fallback 메뉴 반환 (App Shell 패턴 — 네비게이션은 항상 표시)
        return cachedMenus ?? FALLBACK_MENUS;
    }
}
