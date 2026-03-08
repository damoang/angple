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
        .map((m) => (m.children ? { ...m, children: filterMenus(m.children) } : m));
}

class MenuStore {
    menus = $state<MenuItem[]>([]);
    loading = $state(false);
    error = $state<string | null>(null);

    /**
     * show_in_header가 true인 메뉴만 order_num 순으로 반환
     */
    get headerMenus(): MenuItem[] {
        return this.collectHeaderMenus(this.menus).sort((a, b) => a.order_num - b.order_num);
    }

    private collectHeaderMenus(menus: MenuItem[]): MenuItem[] {
        const result: MenuItem[] = [];
        for (const m of menus) {
            if (m.show_in_header) result.push(m);
            if (m.children) {
                result.push(...this.collectHeaderMenus(m.children));
            }
        }
        return result;
    }

    /**
     * SSR 데이터로 메뉴 초기화 (동일 데이터 시 리렌더 방지)
     */
    initFromServer(menus: MenuItem[]) {
        const filtered = filterMenus(menus);
        if (
            this.menus.length === filtered.length &&
            JSON.stringify(this.menus) === JSON.stringify(filtered)
        ) {
            return;
        }
        this.menus = filtered;
        this.error = null;
    }
}

export const menuStore = new MenuStore();
