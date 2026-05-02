/**
 * Phase B-1 Prebid header bidding 설정 (canary feature flag 적용).
 *
 * 운영 활성: env `PUBLIC_PHASE_B1_CANARY_PCT` 0~100 사이 정수.
 * 0 = OFF (기본). 1 = 1% 트래픽. 100 = 전체. 그 외 = 모듈 미사용.
 *
 * 1차 적용 대상: Phase A baseline 의 sub 유닛 (`banner-responsive_sub`) — 수익 53.7%.
 * 1차 SSP: Criteo + AppNexus. 환경변수로 publisher ID 주입.
 */

export const PREBID_CDN =
    'https://cdn.jsdelivr.net/npm/prebid.js@9.31.0/dist/not-for-prod/prebid.min.js';

export const CANARY_PCT = Number(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
        ?.PUBLIC_PHASE_B1_CANARY_PCT ?? '0'
);

/**
 * GAM `gpt.js` preload canary 비율 (audit P0-B, 5/22 미팅 직결).
 * `PUBLIC_GAM_PRELOAD_CANARY_PCT` env: 0~100 정수. 기본 0 (OFF).
 * Prebid canary 와 분리 — GAM preload 는 first-impression 지연 측정 용도.
 */
export const GAM_PRELOAD_CANARY_PCT = Number(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
        ?.PUBLIC_GAM_PRELOAD_CANARY_PCT ?? '0'
);

export const PREBID_BIDDER_TIMEOUT_MS = 1000;

export const PHASE_B1_SLOTS = new Set<string>([
    'sidebar',
    'sidebar-sticky-desktop',
    'sidebar-sticky',
    'sidebar-1',
    'sidebar-b2b'
]);

export type PrebidBidder = {
    bidder: string;
    params: Record<string, unknown>;
};

export const PREBID_BIDDERS_DEFAULT: PrebidBidder[] = [
    {
        bidder: 'criteo',
        params: {
            networkId: Number(
                (import.meta as ImportMeta & { env?: Record<string, string> }).env
                    ?.PUBLIC_CRITEO_NETWORK_ID ?? '0'
            )
        }
    },
    {
        bidder: 'appnexus',
        params: {
            placementId: Number(
                (import.meta as ImportMeta & { env?: Record<string, string> }).env
                    ?.PUBLIC_APPNEXUS_PLACEMENT_ID ?? '0'
            )
        }
    }
];

export const PREBID_SIZES_BY_POSITION: Record<string, Array<[number, number]>> = {
    sidebar: [[300, 250]],
    'sidebar-sticky-desktop': [
        [300, 600],
        [300, 250]
    ],
    'sidebar-sticky': [
        [300, 600],
        [300, 250]
    ],
    'sidebar-1': [[300, 250]],
    'sidebar-b2b': [[300, 250]]
};

/**
 * 안정적 사용자 hash 기반 canary 그룹 결정.
 * 같은 userKey 는 항상 같은 결과 (Prebid on/off 가 사용자별 고정).
 */
export function isInCanary(userKey: string | null | undefined): boolean {
    if (!CANARY_PCT || CANARY_PCT <= 0 || CANARY_PCT > 100) return false;
    if (CANARY_PCT >= 100) return true;
    if (!userKey) return false;
    let hash = 0x811c9dc5;
    for (let i = 0; i < userKey.length; i++) {
        hash ^= userKey.charCodeAt(i);
        hash =
            (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash % 100 < CANARY_PCT;
}

/**
 * GAM gpt.js preload canary 그룹 결정 (Prebid 와 분리된 hash salt 사용).
 * Prebid canary 와 같은 사용자 hash 충돌을 피하기 위해 prefix 추가.
 */
export function isInPreloadCanary(userKey: string | null | undefined): boolean {
    if (!GAM_PRELOAD_CANARY_PCT || GAM_PRELOAD_CANARY_PCT <= 0 || GAM_PRELOAD_CANARY_PCT > 100)
        return false;
    if (GAM_PRELOAD_CANARY_PCT >= 100) return true;
    const salted = `gam-preload:${userKey ?? ''}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < salted.length; i++) {
        hash ^= salted.charCodeAt(i);
        hash =
            (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash % 100 < GAM_PRELOAD_CANARY_PCT;
}
