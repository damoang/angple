/**
 * 인덱스 위젯 데이터 관리 스토어 (Svelte 5 Runes)
 *
 * 홈페이지 위젯들이 공유하는 데이터를 중앙에서 관리:
 * - news_tabs: 새로운 소식
 * - economy_tabs: 알뜰구매
 * - gallery: 갤러리
 * - group_tabs: 소모임 추천글
 */

import { apiClient } from '$lib/api';
import type {
    IndexWidgetsData,
    NewsPost,
    EconomyPost,
    GalleryPost,
    GroupTabsData
} from '$lib/api/types.js';

class IndexWidgetsStore {
    // === State ===
    data = $state<IndexWidgetsData | null>(null);
    isLoading = $state(false);
    error = $state<string | null>(null);
    lastFetchedAt = $state<Date | null>(null);

    // === Derived Getters ===
    get newsTabs(): NewsPost[] {
        return this.data?.news_tabs ?? [];
    }

    get economyTabs(): EconomyPost[] {
        return this.data?.economy_tabs ?? [];
    }

    get gallery(): GalleryPost[] {
        return this.data?.gallery ?? [];
    }

    get groupTabs(): GroupTabsData | null {
        return this.data?.group_tabs ?? null;
    }

    get hasData(): boolean {
        return this.data !== null;
    }

    // === Actions ===

    /**
     * SSR 데이터로 스토어 초기화 (깜박임 방지)
     */
    initFromServer(serverData: IndexWidgetsData | null): void {
        this.data = serverData;
        this.isLoading = false;
        this.error = null;
        this.lastFetchedAt = serverData ? new Date() : null;
    }

    /**
     * 클라이언트에서 데이터 fetch
     */
    async fetchData(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.error = null;

        try {
            const response = await apiClient.getIndexWidgets();
            this.data = response;
            this.lastFetchedAt = new Date();
        } catch (err) {
            this.error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('[IndexWidgets Store] Fetch error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 스토어 리셋
     */
    reset(): void {
        this.data = null;
        this.error = null;
        this.isLoading = false;
        this.lastFetchedAt = null;
    }
}

export const indexWidgetsStore = new IndexWidgetsStore();
