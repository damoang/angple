/**
 * 메뉴 데이터 스토어
 *
 * SSR에서 로드한 메뉴 데이터를 저장하여 클라이언트 API 호출을 제거합니다.
 * +layout.server.ts → +layout.svelte → menuStore.initFromServer() 순으로 초기화됩니다.
 */

import type { MenuItem } from '$lib/api/types';

// 비활성화할 메뉴 ID 목록
const HIDDEN_MENU_IDS = new Set([261]); // 앙수호대

function filterMenus(menus: MenuItem[]): MenuItem[] {
    return menus
        .filter((m) => !HIDDEN_MENU_IDS.has(m.id))
        .map((m) =>
            m.children
                ? { ...m, children: m.children.filter((c) => !HIDDEN_MENU_IDS.has(c.id)) }
                : m
        );
}

class MenuStore {
    menus = $state<MenuItem[]>([]);
    loading = $state(true);
    error = $state<string | null>(null);

    /**
     * SSR 데이터로 메뉴 초기화
     */
    initFromServer(menus: MenuItem[]) {
        this.menus = filterMenus(menus);
        this.loading = false;
        this.error = null;
    }
}

export const menuStore = new MenuStore();
