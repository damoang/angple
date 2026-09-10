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
import { DEFAULT_TAG_NAV_MENUS, type TagNavMenu } from '$lib/components/ui/tag-nav/default-menus';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

// 메뉴 캐시: L1 60초 / L2(Redis) 5분. 짧게 둬서 메뉴 변경(관리자 편집/외부 INSERT)이
// invalidateMenuCache() 수동 호출 없이도 수 분 내 자동 반영되게 한다. menu 쿼리는 가벼워
// 5분마다 재조회해도 부하 무시 가능(L1 60초가 대부분 흡수). 이전엔 24h/7일이라 stale 메뉴가
// 오래 남아 "관리자에서 바꿔도 안 보임"이 반복됐다.
// 2026-04-26: maxL1=100 명시 (이전엔 무제한). 사이트별 1키만 사용해 충분.
const menuCache = new TieredCache<MenuItem[]>('menus:sidebar', 60_000, 300, 100);

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

// ── 상단 tag-nav 메뉴 (menus.show_in_tagnav 구동) ─────────────────────────
// 하드코딩 DEFAULT_TAG_NAV_MENUS 를 단일 출처(menus 테이블)로 대체하기 위한 SSR 로더.
// 백엔드 /api/v1/menus/tagnav 를 호출하고, 실패/빈값이면 하드코딩으로 폴백(무중단).
const tagNavCache = new TieredCache<TagNavMenu[]>('menus:tagnav', 60_000, 300, 100);
let lastKnownTagNav: TagNavMenu[] | null = null;

/** '/explore' → 'explore'. key 는 {#each} 식별자 용도라 url 슬러그로 파생한다. */
function tagNavKey(url: string): string {
    const slug = (url || '').replace(/^\//, '').replace(/[/?#].*$/, '');
    return slug || url || 'item';
}

/**
 * 상단 tag-nav 메뉴를 서버에서 로드. show_in_tagnav 메뉴가 없거나 백엔드 실패 시
 * 하드코딩 기본값으로 폴백해 전환 중에도 tag-nav 가 비지 않게 한다.
 */
export async function loadTagNavMenus(): Promise<TagNavMenu[]> {
    try {
        return await tagNavCache.getOrFetch('all', async () => {
            const response = await fetch(`${BACKEND_URL}/api/v1/menus/tagnav`, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Angple-Web-SSR/1.0'
                },
                signal: AbortSignal.timeout(3_000)
            });
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            const result = await response.json();
            const rows = Array.isArray(result.data) ? result.data : [];
            // 빈 목록이면 아직 seed 전 → 하드코딩 폴백(전환 무중단)
            if (rows.length === 0) {
                return DEFAULT_TAG_NAV_MENUS;
            }
            const menus: TagNavMenu[] = rows.map((m: { title: string; url: string }) => ({
                key: tagNavKey(m.url),
                text: m.title,
                url: m.url,
                show: true
            }));
            lastKnownTagNav = menus;
            return menus;
        });
    } catch (err) {
        console.error('[menu-loader] tagnav fetch failed:', err);
        return lastKnownTagNav ?? DEFAULT_TAG_NAV_MENUS;
    }
}

/** tag-nav 캐시 무효화 (관리자 편집/외부 변경 시). */
export async function invalidateTagNavCache(): Promise<void> {
    await tagNavCache.delete('all');
    lastKnownTagNav = null;
    await loadTagNavMenus();
}
