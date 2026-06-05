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
import { TieredCache } from '$lib/server/cache';

// 메뉴는 거의 안 바뀜 → L1 24시간, L2(Redis) 7일. 변경 시 invalidateMenuCache() 호출.
// (위키앙 빌드는 현재 정적 WIKIANG_MENUS 사용 — cache invalidate 호환 위해 유지)
const menuCache = new TieredCache<MenuItem[]>('menus:sidebar', 86_400_000, 604_800);

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

// 위키앙 전용 사이드바 메뉴 (wikiang.org).
// 이 빌드는 damoang backend (/api/v1/menus/sidebar) 를 공유하므로 그대로 fetch 하면
// 다모앙 커뮤니티 메뉴(/free, /damoang 등)가 위키앙 사이드바에 노출됨.
// multi-site menu 분리 (Phase 8) 전까지, 위키앙 빌드는 백엔드 fetch 대신 이 정적 메뉴 사용.
const WIKIANG_MENUS: MenuItem[] = [
    {
        ...menuDefaults,
        id: 8001,
        title: '대문',
        url: '/대문',
        icon: 'House',
        children: []
    },
    {
        ...menuDefaults,
        id: 8002,
        title: '최근 바뀜',
        url: '/특수:최근바뀜',
        icon: 'Clock',
        children: []
    },
    {
        ...menuDefaults,
        id: 8003,
        title: '분류',
        url: '/특수:분류',
        icon: 'FolderTree',
        children: []
    },
    {
        ...menuDefaults,
        id: 8004,
        title: '무작위 문서',
        url: '/특수:무작위',
        icon: 'Shuffle',
        children: []
    },
    {
        ...menuDefaults,
        id: 8005,
        title: '도움말',
        url: '/도움말',
        icon: 'CircleHelp',
        children: []
    }
];

// 마지막으로 성공한 데이터 (graceful degradation용)
let lastKnownMenus: MenuItem[] | null = null;

/**
 * 메뉴 데이터를 서버에서 로드 (L1 60초 + L2 300초 TieredCache)
 */
export async function loadMenus(): Promise<MenuItem[]> {
    // 위키앙 빌드: damoang backend 메뉴를 fetch 하면 다모앙 커뮤니티 메뉴가 노출되므로
    // 위키앙 전용 정적 메뉴 반환 (Phase 8 multi-site menu 분리 전까지의 단기 조치).
    // 백엔드 fetch / 캐시 불필요 (정적).
    return WIKIANG_MENUS;
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
