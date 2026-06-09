/**
 * 마음메시지 공유 스토어
 *
 * CelebrationRolling(텍스트)과 DamoangBanner(이미지)가
 * 동일한 데이터와 인덱스를 공유하여 싱크 롤링
 *
 * 표시 순서 정책:
 *   - shuffledOrder 가 celebrations 배열의 인덱스 순열을 보관한다.
 *   - 매 tick 마다 position 을 증가시키고 shuffledOrder[position] 을 currentIndex 로 발행한다.
 *   - position 이 shuffledOrder.length 에 도달하면 (= 풀 로테이션 완료)
 *     재셔플 후 position=0 부터 다시 시작 → 모든 메시지의 균등 노출 보장.
 */
import { browser } from '$app/environment';

export interface CelebrationBanner {
    id: number;
    title: string;
    content: string;
    image_url: string;
    link_url: string;
    target_member_nick?: string;
    target_member_photo?: string;
    external_link?: string;
    link_target?: string;
    display_type?: 'image' | 'text';
    alt_text?: string;
    target?: string;
}

let celebrations = $state<CelebrationBanner[]>([]);
let currentIndex = $state(0);
// 셔플된 표시 순서. celebrations 배열의 인덱스를 가리킨다.
// 풀 로테이션이 끝나면 재셔플하여 모든 메시지가 균등하게 노출되도록 한다.
let shuffledOrder: number[] = [];
let position = 0; // shuffledOrder 내의 현재 위치
let fetched = false;
let ready = false;
let fetchPromise: Promise<void> | null = null;
let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
// 롤링 주기. 사용자 요청으로 3s → 2s 로 추가 단축 (메시지 6개 기준 한 바퀴 12s).
const CELEBRATION_ROTATION_INTERVAL_MS = 2_000;

/** Fisher-Yates 셔플 (in-place). length<=1 이면 변경 없이 반환 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** celebrations 길이에 맞춰 shuffledOrder 를 새로 셔플하고 position/currentIndex 를 첫 항목으로 리셋 */
function reshuffleOrder(): void {
    const len = celebrations.length;
    if (len === 0) {
        shuffledOrder = [];
        position = 0;
        currentIndex = 0;
        return;
    }
    const order = Array.from({ length: len }, (_, i) => i);
    fisherYatesShuffle(order);
    shuffledOrder = order;
    position = 0;
    currentIndex = order[0] ?? 0;
}

async function doFetch(): Promise<void> {
    if (!browser) return;

    try {
        const response = await fetch('/api/celebration/today', {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) return;

        const result = await response.json();

        if (result.data?.length > 0) {
            // 원본 배열은 안정적으로 유지하고 표시 순서는 shuffledOrder 로 제어한다.
            celebrations = [...result.data];
            reshuffleOrder();
        }
    } catch (error) {
        console.warn('CelebrationStore: 마음메시지 로드 실패', error);
    }
}

function startRotation(): void {
    if (intervalId) return;
    intervalId = setInterval(() => {
        const len = celebrations.length;
        if (len <= 1) return;
        // 다음 위치로 이동. shuffledOrder 의 끝에 도달하면 재셔플(풀 로테이션 후 새 셔플).
        const nextPos = position + 1;
        if (nextPos >= shuffledOrder.length) {
            reshuffleOrder();
        } else {
            position = nextPos;
            currentIndex = shuffledOrder[nextPos] ?? 0;
        }
    }, CELEBRATION_ROTATION_INTERVAL_MS);
}

function stopRotation(): void {
    // 로테이션을 멈추지 않음 — 페이지 전환 시에도 계속 회전
    // 첫 화면 ↔ 게시판 이동 시 멈춤 방지
}

export function getCelebrations(): CelebrationBanner[] {
    return celebrations;
}

export function getCurrentIndex(): number {
    return currentIndex;
}

export function isReady(): boolean {
    return ready;
}

export function setCurrentIndex(index: number): void {
    currentIndex = index;
}

/** 배너 링크: external_link 우선 → link_url → /message/{id} (현재창 내비게이션) */
export function getLink(banner: CelebrationBanner): string {
    const raw = banner.external_link || banner.link_url || `/message/${banner.id}`;
    // 절대 URL을 상대 경로로 변환 (SPA 내비게이션, 현재창)
    if (browser) {
        try {
            const url = new URL(raw, window.location.origin);
            if (url.hostname === window.location.hostname || url.hostname.endsWith('damoang.net')) {
                return url.pathname + url.search + url.hash;
            }
        } catch {
            // 파싱 실패 시 원본
        }
    }
    return raw;
}

/** 외부 데이터로 초기화 (app-init 스토어에서 주입 시 fetch 스킵) */
export function initFromData(data: CelebrationBanner[]): void {
    if (fetched) return;

    if (data.length > 0) {
        celebrations = [...data];
        reshuffleOrder();
    }
    // 빈 배열로 초기화되더라도 ready=true 여야 fallback 문구를 렌더할 수 있다.
    fetched = true;
    ready = true;
}

/** 컴포넌트 마운트 시 호출. fetch + rotation 시작. cleanup 함수 반환 */
export function mount(): () => void {
    refCount++;

    if (!fetched && !fetchPromise) {
        fetchPromise = doFetch().then(() => {
            fetched = true;
            ready = true;
            fetchPromise = null;
        });
    }

    startRotation();

    return () => {
        refCount--;
        if (refCount <= 0) {
            refCount = 0;
            stopRotation();
        }
    };
}
