/**
 * 광고 밀도 제어 — 페이지당 최대 광고 수 제한
 * 데스크톱: 최대 5개, 모바일: 최대 3개
 */
import { browser } from '$app/environment';

const DESKTOP_LIMIT = 5;
const MOBILE_LIMIT = 3;

class AdDensityStore {
    private _slots = $state<Set<string>>(new Set());

    get visibleCount(): number {
        return this._slots.size;
    }

    get limit(): number {
        if (!browser) return DESKTOP_LIMIT;
        return window.innerWidth >= 1024 ? DESKTOP_LIMIT : MOBILE_LIMIT;
    }

    get canShowMore(): boolean {
        return this._slots.size < this.limit;
    }

    register(slotId: string): boolean {
        if (this._slots.size >= this.limit) return false;
        this._slots = new Set([...this._slots, slotId]);
        return true;
    }

    unregister(slotId: string): void {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- 복사본을 만든 뒤 $state 에 다시 대입해 갱신을 알리는 패턴이라 반응형 컬렉션이 필요 없다
        const next = new Set(this._slots);
        next.delete(slotId);
        this._slots = next;
    }
}

export const adDensityStore = new AdDensityStore();
