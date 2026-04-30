/**
 * Prebid.js 동적 로드 + auction 실행 (Phase B-1, canary 조건일 때만 호출).
 * 실패 / timeout → 빈 targeting 으로 resolve → 호출자가 GAM 으로 폴백.
 */

import { PREBID_BIDDER_TIMEOUT_MS, PREBID_CDN } from './prebid-config.js';

type PbjsCommandQueue = Array<() => void>;
type Pbjs = {
    que: PbjsCommandQueue;
    addAdUnits: (units: unknown) => void;
    requestBids: (cfg: { timeout: number; bidsBackHandler: () => void }) => void;
    setTargetingForGPTAsync: (codes: string[]) => void;
};

let loadingPromise: Promise<void> | null = null;

export function loadPrebid(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const w = window as unknown as { pbjs?: Pbjs; _pbjsLoaded?: boolean };
    if (w._pbjsLoaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise((resolve, reject) => {
        w.pbjs = w.pbjs ?? ({ que: [] } as unknown as Pbjs);
        const script = document.createElement('script');
        script.src = PREBID_CDN;
        script.async = true;
        script.onload = () => {
            w._pbjsLoaded = true;
            resolve();
        };
        script.onerror = () => {
            loadingPromise = null;
            reject(new Error('Prebid script load failed'));
        };
        document.head.appendChild(script);
    });
    return loadingPromise;
}

export type PrebidBidParams = {
    code: string;
    sizes: Array<[number, number]>;
    bidders: Array<{ bidder: string; params: Record<string, unknown> }>;
};

/**
 * Prebid auction → GAM targeting 자동 set.
 * 항상 resolve (실패 시도 silent). 호출자는 await 후 그냥 GAM 진행.
 */
export async function runPrebidAuction(unit: PrebidBidParams): Promise<void> {
    try {
        await loadPrebid();
    } catch {
        return;
    }
    if (typeof window === 'undefined') return;
    return new Promise((resolve) => {
        const w = window as unknown as { pbjs: Pbjs };
        const finish = () => resolve();
        const safety = setTimeout(finish, PREBID_BIDDER_TIMEOUT_MS + 200);
        w.pbjs.que.push(() => {
            try {
                w.pbjs.addAdUnits([
                    {
                        code: unit.code,
                        mediaTypes: { banner: { sizes: unit.sizes } },
                        bids: unit.bidders
                    }
                ]);
                w.pbjs.requestBids({
                    timeout: PREBID_BIDDER_TIMEOUT_MS,
                    bidsBackHandler: () => {
                        try {
                            w.pbjs.setTargetingForGPTAsync([unit.code]);
                        } catch {
                            /* swallow */
                        }
                        clearTimeout(safety);
                        finish();
                    }
                });
            } catch {
                clearTimeout(safety);
                finish();
            }
        });
    });
}
