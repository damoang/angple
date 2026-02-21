/**
 * 서버 사이드 메뉴 데이터 로더 (인메모리 캐시)
 *
 * Go 백엔드의 /api/v1/menus/sidebar를 SSR에서 호출하여 캐시합니다.
 * 클라이언트 사이드 API 호출을 제거하여 동접 1만명 환경에서의 부하를 줄입니다.
 */

import type { MenuItem } from '$lib/api/types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

let cachedMenus: MenuItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 300_000; // 5분 (메뉴는 거의 변경되지 않음)

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
            }
        });

        if (!response.ok) {
            console.error('[menu-loader] API error:', response.status);
            return cachedMenus ?? [];
        }

        const result = await response.json();
        const menus: MenuItem[] = result.data ?? [];

        cachedMenus = menus;
        cacheTimestamp = now;

        return menus;
    } catch (err) {
        console.error('[menu-loader] fetch failed:', err);
        // 캐시가 있으면 만료되었더라도 반환 (graceful degradation)
        return cachedMenus ?? [];
    }
}
