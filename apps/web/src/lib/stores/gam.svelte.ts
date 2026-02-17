/**
 * GAM (Google Ad Manager) 설정 Store
 * - GPT 초기화 관리
 * - 슬롯 등록/해제 관리
 * - 다크모드 타겟팅 연동
 */

import { browser } from '$app/environment';
import type { GAMConfig } from '$lib/types/advertising';
import type { GoogleTagSlot, GoogleTagSlotRenderEndedEvent } from '$lib/types/googletag';
import {
    loadGPT,
    initializeGPT,
    updateThemeTargeting,
    addDnsPrefetch
} from '$lib/utils/gpt-loader';

// GAM 네트워크 코드 (환경변수로 설정)
const NETWORK_CODE = import.meta.env.VITE_GAM_NETWORK_CODE || '';

// AdSense 클라이언트 ID (환경변수로 설정)
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || '';

// GAM 상태 관리
interface GAMState {
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;
    config: GAMConfig;
    slots: Map<string, GoogleTagSlot>;
    emptySlots: Set<string>;
}

const state = $state<GAMState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    config: {
        network_code: NETWORK_CODE,
        enable_gam: true,
        enable_fallback: true
    },
    slots: new Map(),
    emptySlots: new Set()
});

// 슬롯 렌더 이벤트 콜백 저장
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive callback storage
const slotCallbacks = new Map<string, (isEmpty: boolean) => void>();

/**
 * GAM 초기화
 */
export async function initGAM(): Promise<boolean> {
    if (!browser) return false;
    if (state.isInitialized) return true;
    if (state.isLoading) return false;

    state.isLoading = true;
    state.error = null;

    try {
        // DNS Prefetch 추가
        addDnsPrefetch();

        // GPT 스크립트 로드
        await loadGPT();

        // GPT 초기화
        const siteName = import.meta.env.VITE_GAM_SITE_NAME || '';
        initializeGPT({
            collapseEmptyDivs: true,
            singleRequest: true,
            targeting: siteName ? { site: siteName } : {}
        });

        // 슬롯 렌더 이벤트 리스너 등록
        window.googletag!.cmd.push(() => {
            window.googletag!.pubads().addEventListener('slotRenderEnded', handleSlotRenderEnded);
        });

        state.isInitialized = true;
        state.isLoading = false;

        return true;
    } catch (error) {
        state.error = error instanceof Error ? error.message : 'GAM 초기화 실패';
        state.isLoading = false;
        console.error('[GAM] 초기화 실패:', error);
        return false;
    }
}

/**
 * 슬롯 렌더 완료 이벤트 핸들러
 */
function handleSlotRenderEnded(event: GoogleTagSlotRenderEndedEvent): void {
    const slotId = event.slot.getSlotElementId();

    if (event.isEmpty) {
        state.emptySlots.add(slotId);
    } else {
        state.emptySlots.delete(slotId);
    }

    // 등록된 콜백 호출
    const callback = slotCallbacks.get(slotId);
    if (callback) {
        callback(event.isEmpty);
    }
}

/**
 * GAM 슬롯 정의 및 표시
 */
export function defineSlot(
    position: string,
    divId: string,
    sizes: number[][],
    onRenderEnd?: (isEmpty: boolean) => void
): GoogleTagSlot | null {
    if (!browser || !state.isInitialized || !window.googletag) {
        return null;
    }

    // 콜백 등록
    if (onRenderEnd) {
        slotCallbacks.set(divId, onRenderEnd);
    }

    let slot: GoogleTagSlot | null = null;

    window.googletag.cmd.push(() => {
        const adUnitPath = `/${NETWORK_CODE}/${position}`;

        // 슬롯 정의
        slot = window.googletag!.defineSlot(adUnitPath, sizes as googletag.GeneralSize, divId);

        if (slot) {
            slot.addService(window.googletag!.pubads());
            state.slots.set(divId, slot);

            // 슬롯 표시
            window.googletag!.display(divId);
        }
    });

    return slot;
}

/**
 * 반응형 사이즈 매핑으로 슬롯 정의
 */
export function defineResponsiveSlot(
    position: string,
    divId: string,
    sizeMapping: Array<{ viewport: number[]; sizes: number[][] }>,
    onRenderEnd?: (isEmpty: boolean) => void
): GoogleTagSlot | null {
    if (!browser || !state.isInitialized || !window.googletag) {
        return null;
    }

    // 콜백 등록
    if (onRenderEnd) {
        slotCallbacks.set(divId, onRenderEnd);
    }

    let slot: GoogleTagSlot | null = null;

    window.googletag.cmd.push(() => {
        const adUnitPath = `/${NETWORK_CODE}/${position}`;

        // 모든 사이즈 수집
        const allSizes = sizeMapping.flatMap((m) => m.sizes);
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- deduplication only, not reactive
        const uniqueSizes = Array.from(new Set(allSizes.map((s) => JSON.stringify(s)))).map(
            (s) => JSON.parse(s) as number[]
        );

        // 슬롯 정의
        slot = window.googletag!.defineSlot(
            adUnitPath,
            uniqueSizes as googletag.GeneralSize,
            divId
        );

        if (slot) {
            // 사이즈 매핑 빌더
            const mapping = window.googletag!.sizeMapping();

            sizeMapping.forEach(({ viewport, sizes }) => {
                mapping.addSize(
                    viewport as googletag.SingleSizeArray,
                    sizes as googletag.GeneralSize
                );
            });

            const builtMapping = mapping.build();
            if (builtMapping) {
                slot.defineSizeMapping(builtMapping);
            }
            slot.addService(window.googletag!.pubads());
            state.slots.set(divId, slot);

            // 슬롯 표시
            window.googletag!.display(divId);
        }
    });

    return slot;
}

/**
 * 슬롯 제거
 */
export function destroySlot(divId: string): boolean {
    if (!browser || !window.googletag) return false;

    const slot = state.slots.get(divId);
    if (!slot) return false;

    window.googletag.cmd.push(() => {
        window.googletag!.destroySlots([slot]);
        state.slots.delete(divId);
        state.emptySlots.delete(divId);
        slotCallbacks.delete(divId);
    });

    return true;
}

/**
 * 특정 슬롯 새로고침
 */
export function refreshSlot(divId: string): void {
    if (!browser || !window.googletag) return;

    const slot = state.slots.get(divId);
    if (!slot) return;

    window.googletag.cmd.push(() => {
        window.googletag!.pubads().refresh([slot], { changeCorrelator: false });
    });
}

/**
 * 테마 변경 시 호출
 */
export function setTheme(theme: 'light' | 'dark'): void {
    updateThemeTargeting(theme);
}

/**
 * 슬롯이 비어있는지 확인
 */
export function isSlotEmpty(divId: string): boolean {
    return state.emptySlots.has(divId);
}

// Getter 함수들
export function getGAMState() {
    return state;
}

export function isGAMInitialized() {
    return state.isInitialized;
}

export function getNetworkCode() {
    return NETWORK_CODE;
}

export function getAdSenseClient() {
    return ADSENSE_CLIENT;
}
