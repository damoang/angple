/**
 * 축하메시지 공유 스토어
 *
 * CelebrationRolling(텍스트)과 DamoangBanner(이미지)가
 * 동일한 데이터와 인덱스를 공유하여 싱크 롤링
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
let fetched = false;
let ready = false;
let fetchPromise: Promise<void> | null = null;
let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const CELEBRATION_ROTATION_INTERVAL_MS = 30_000;

async function doFetch(): Promise<void> {
    if (!browser) return;

    try {
        const response = await fetch('/api/ads/celebration/today', {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) return;

        const result = await response.json();

        if (result.data?.length > 0) {
            // Fisher-Yates 셔플 (랜덤 순서)
            const arr = [...result.data];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            celebrations = arr;
        }
    } catch (error) {
        console.warn('CelebrationStore: 축하메시지 로드 실패', error);
    }
}

function startRotation(): void {
    if (intervalId) return;
    intervalId = setInterval(() => {
        if (celebrations.length > 1) {
            currentIndex = (currentIndex + 1) % celebrations.length;
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
        const arr = [...data];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        celebrations = arr;
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
