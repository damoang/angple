/**
 * 보드 가운데 잠깐 뜨는 장군·멍군 알림 상태 — 로컬·온라인 판이 같이 쓴다.
 * 보여 주는 시간은 여기서 정하고(감소된 움직임 설정이어도 같은 시간만 떠 있다),
 * 움직임은 보드 CSS 가 맡는다.
 */
import { CHECK_EVENT_TEXT, CHECK_FLASH_MS, type CheckEvent } from './check-events';

export interface BoardFlash {
    text: string;
    id: number;
    tone: 'check' | 'block';
}

export class CheckFlash {
    current = $state<BoardFlash | null>(null);
    #seq = 0;
    #timer: ReturnType<typeof setTimeout> | null = null;

    show(ev: CheckEvent) {
        this.#stop();
        this.#seq++;
        this.current = {
            text: CHECK_EVENT_TEXT[ev],
            id: this.#seq,
            tone: ev === 'janggun' ? 'check' : 'block'
        };
        this.#timer = setTimeout(() => {
            this.current = null;
            this.#timer = null;
        }, CHECK_FLASH_MS);
    }

    clear() {
        this.#stop();
        this.current = null;
    }

    #stop() {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = null;
    }
}
