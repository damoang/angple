/**
 * 서버 사이드 메뉴 데이터 로더 (TieredCache: L1 인메모리 + L2 Redis)
 *
 * Go 백엔드의 /api/v1/menus/sidebar를 SSR에서 호출하여 캐시합니다.
 * 클라이언트 사이드 API 호출을 제거하여 동접 1만명 환경에서의 부하를 줄입니다.
 *
 * L1: 60초 인메모리 (단일 파드 내 빠른 응답)
 * L2: 300초 Redis (파드 간 공유)
 */

import type { MenuItem } from '$lib/api/types';
import { env } from '$env/dynamic/private';
import { TieredCache } from '$lib/server/cache';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

// 메뉴는 거의 안 바뀜 → L1 24시간, L2(Redis) 7일. 변경 시 invalidateMenuCache() 호출
// 2026-04-26: maxL1=100 명시 (이전엔 무제한). 사이트별 1키만 사용해 충분.
const menuCache = new TieredCache<MenuItem[]>('menus:sidebar', 86_400_000, 604_800, 100);

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

// 마지막으로 성공한 데이터 (graceful degradation용)
let lastKnownMenus: MenuItem[] | null = null;

/**
 * 메뉴 데이터를 서버에서 로드 (L1 60초 + L2 300초 TieredCache)
 */
export async function loadMenus(): Promise<MenuItem[]> {
    try {
        return await menuCache.getOrFetch('all', async () => {
            const response = await fetch(`${BACKEND_URL}/api/v1/menus/sidebar`, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Angple-Web-SSR/1.0'
                },
                signal: AbortSignal.timeout(3_000)
            });

            if (!response.ok) {
                console.error('[menu-loader] API error:', response.status);
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();
            const menus: MenuItem[] = result.data ?? [];
            lastKnownMenus = menus;
            return menus;
        });
    } catch (err) {
        console.error('[menu-loader] fetch failed:', err);
        // 캐시가 있으면 만료되었더라도 반환 (graceful degradation)
        // 캐시도 없으면 fallback 메뉴 반환 (App Shell 패턴 — 네비게이션은 항상 표시)
        return lastKnownMenus ?? FALLBACK_MENUS;
    }
}

/**
 * 메뉴 캐시 무효화 — 관리자 메뉴 변경 시 호출
 * L1(인메모리) + L2(Redis) 모두 삭제 후 즉시 재로드
 */
export async function invalidateMenuCache(): Promise<void> {
    await menuCache.delete('all');
    lastKnownMenus = null;
    // 즉시 재로드하여 새 데이터로 캐시 채움
    await loadMenus();
}
