/**
 * Phase B-1 Prebid header bidding 설정 (canary feature flag 적용).
 *
 * 운영 활성: env `PUBLIC_PHASE_B1_CANARY_PCT` 0~100 사이 정수.
 * 0 = OFF (기본). 1 = 1% 트래픽. 100 = 전체. 그 외 = 모듈 미사용.
 *
 * 1차 적용 대상: Phase A baseline 의 sub 유닛 (`banner-responsive_sub`) — 수익 53.7%.
 * 1차 SSP: Criteo + AppNexus. 환경변수로 publisher ID 주입.
 */

/**
 * ⛔ 이 URL 은 Prebid.js 의 **`not-for-prod` 데모 빌드**다.
 *    전 어댑터가 포함돼 용량이 크고, Prebid 측이 프로덕션 사용을 명시적으로 금지한다.
 *
 *    `PUBLIC_PHASE_B1_CANARY_PCT` 를 0 보다 크게 올리기 **전에** 반드시 교체할 것:
 *      1. docs.prebid.org/download.html 에서 필요한 어댑터만 골라 커스텀 빌드
 *         (현재 설정 기준: criteoBidAdapter, appnexusBidAdapter, gptPreAuction, consentManagementTcf)
 *      2. static.damoang.net 에 자체 호스팅 (서드파티 CDN 의존 제거)
 *      3. 이 상수 교체 + CSP script-src 확인
 *
 *    교체 전에 canary 를 켜면 프로덕션에 데모 빌드가 나간다.
 */
export const PREBID_CDN =
    'https://cdn.jsdelivr.net/npm/prebid.js@9.31.0/dist/not-for-prod/prebid.min.js';

/**
 * ⚠️ 2026-10-17 현재 **0 (OFF)** 이다. deploy.yml 에도 이 env 주입이 없어
 *    빌드 결과물의 `import.meta.env` 가 빈 객체이고, 아무도 canary 에 들어가지 않는다.
 *
 *    켜기 전 선결 조건 3가지 (하나라도 빠지면 수익이 0 이다):
 *      (A) PREBID_CDN 을 프로덕션 빌드로 교체 (위 주석 참고)
 *      (B) PUBLIC_CRITEO_NETWORK_ID / PUBLIC_APPNEXUS_PLACEMENT_ID 발급 — 현재 둘 다 0
 *      (C) GAM 에 Prebid 라인아이템·키값(hb_pb, hb_adid, hb_size) 생성
 *          — 현재 페이지 타게팅 키는 site/theme/hour/device 뿐이라 낙찰돼도 게재되지 않는다
 *
 *    상세 절차: ~/Documents/damoang-programmatic-enablement-guide.md
 */
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

/**
 * ⚠️ 두 ID 모두 env 미설정 상태라 현재 **0** 이다. SSP 계약 후 주입해야 한다.
 *    AppNexus 는 placementId 가 지면별로 다른 것이 보통이므로, 계약 후 슬롯별 매핑이
 *    필요하면 이 상수를 함수형(position → bidders)으로 바꿀 것.
 */
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
