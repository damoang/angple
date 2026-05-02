/**
 * 카카오 애드핏 SDK 지연 로딩
 * GAM이 빈 슬롯일 때만 로드하여 불필요한 네트워크 요청 방지
 *
 * audit P1-C: SDK 로드 결과를 status 로 반환 → adfit-slot 이 텔레메트리 송신.
 * 8s timeout — 차단/네트워크 지연 케이스 검출 (5/22 미팅 fill rate 측정).
 */

const ADFIT_SDK_URL = 'https://t1.daumcdn.net/kas/static/ba.min.js';
const ADFIT_LOAD_TIMEOUT_MS = 8_000;

export type AdfitLoadStatus = 'success' | 'failed' | 'timeout';

let loadPromise: Promise<AdfitLoadStatus> | null = null;
const activeAds = new Set<string>();

export function loadAdfitSDK(): Promise<AdfitLoadStatus> {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise<AdfitLoadStatus>((resolve) => {
        if (typeof window === 'undefined') {
            resolve('failed');
            return;
        }

        const existing = document.querySelector(`script[src*="kas/static/ba.min.js"]`);
        if (existing) {
            // 이미 삽입된 스크립트: adfit 함수 존재 여부로 success/failed 판정
            resolve(typeof (window as any).adfit === 'function' ? 'success' : 'failed');
            return;
        }

        const script = document.createElement('script');
        script.src = ADFIT_SDK_URL;
        script.async = true;

        let settled = false;
        const finish = (status: AdfitLoadStatus) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(status);
        };

        const timer = setTimeout(() => finish('timeout'), ADFIT_LOAD_TIMEOUT_MS);

        script.onload = () => finish('success');
        script.onerror = () => finish('failed');
        document.head.appendChild(script);
    });

    return loadPromise;
}

export function renderAdfitAd(containerId: string): void {
    if (typeof window === 'undefined') return;
    if (activeAds.has(containerId)) return;

    activeAds.add(containerId);

    // 애드핏 SDK가 ins 요소를 자동으로 채움
    // ba.min.js는 페이지의 kakao_ad_area 클래스를 가진 ins를 스캔
    try {
        const adfit = (window as any).adfit;
        if (adfit && typeof adfit === 'function') {
            adfit(containerId);
        }
    } catch {
        // 애드핏 렌더 실패 무시
    }
}

export function destroyAdfitAd(containerId: string): void {
    activeAds.delete(containerId);
}
