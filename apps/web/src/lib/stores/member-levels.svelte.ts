/**
 * 회원 레벨 배치 조회 스토어 (Svelte 5 Runes)
 *
 * 게시글/댓글 작성자의 나리야 경험치 레벨(as_level)을 배치로 조회하고 캐시합니다.
 * /api/members/levels 엔드포인트를 사용합니다.
 */
import { SvelteMap } from 'svelte/reactivity';

class MemberLevelStore {
    /** mb_id → as_level 캐시 */
    private levels = new SvelteMap<string, number>();

    /** 현재 로딩 중인 ID Set (중복 요청 방지) */
    private pendingIds = new Set<string>();
    private queuedIds = new Set<string>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private flushPromise: Promise<void> | null = null;
    private resolveFlush: (() => void) | null = null;

    private ensureFlushScheduled(): Promise<void> {
        if (!this.flushPromise) {
            this.flushPromise = new Promise<void>((resolve) => {
                this.resolveFlush = resolve;
            });
        }

        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                void this.flushQueuedIds();
            }, 25);
        }

        return this.flushPromise;
    }

    private async flushQueuedIds(): Promise<void> {
        const ids = [...this.queuedIds];
        this.queuedIds.clear();

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        try {
            for (let i = 0; i < ids.length; i += 100) {
                const chunk = ids.slice(i, i + 100);
                if (chunk.length === 0) continue;

                const response = await fetch(`/api/members/levels?ids=${chunk.join(',')}`);
                if (!response.ok) continue;

                const data: Record<string, number> = await response.json();
                for (const [mbId, level] of Object.entries(data)) {
                    this.levels.set(mbId, level);
                }
            }
        } catch (err) {
            console.error('회원 레벨 조회 실패:', err);
        } finally {
            for (const id of ids) {
                this.pendingIds.delete(id);
            }

            const resolve = this.resolveFlush;
            this.resolveFlush = null;
            this.flushPromise = null;
            resolve?.();
        }
    }

    /**
     * 레벨 배치 조회
     * 이미 캐시된 ID는 건너뛰고 새로운 ID만 요청
     */
    async fetchLevels(ids: string[]): Promise<void> {
        const newIds = ids.filter((id) => id && !this.levels.has(id) && !this.pendingIds.has(id));

        if (newIds.length === 0) return;

        for (const id of newIds) {
            this.pendingIds.add(id);
            this.queuedIds.add(id);
        }

        await this.ensureFlushScheduled();
    }

    /**
     * 특정 회원의 레벨 반환
     */
    getLevel(mbId: string): number | undefined {
        return this.levels.get(mbId);
    }

    /**
     * SSR 데이터로 캐시 초기화 (fetch 없이)
     */
    initFromSSR(data: Record<string, number>): void {
        for (const [mbId, level] of Object.entries(data)) {
            this.levels.set(mbId, level);
        }
    }

    /**
     * 특정 회원의 레벨 업데이트 (authStore 동기화용)
     */
    updateLevel(mbId: string, level: number): void {
        if (!mbId) return;
        const current = this.levels.get(mbId);
        if (current === level) return;
        this.levels.set(mbId, level);
    }

    /**
     * 전체 캐시 클리어
     */
    clear(): void {
        this.levels.clear();
        this.pendingIds.clear();
        this.queuedIds.clear();
    }
}

export const memberLevelStore = new MemberLevelStore();
