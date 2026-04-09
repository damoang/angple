/**
 * 카카오 애드핏 SDK 지연 로딩
 * GAM이 빈 슬롯일 때만 로드하여 불필요한 네트워크 요청 방지
 */

const ADFIT_SDK_URL = '//t1.daumcdn.net/kas/static/ba.min.js';
let loadPromise: Promise<void> | null = null;
const activeAds = new Set<string>();

export function loadAdfitSDK(): Promise<void> {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise<void>((resolve) => {
        if (typeof window === 'undefined') {
            resolve();
            return;
        }

        const existing = document.querySelector(`script[src*="kas/static/ba.min.js"]`);
        if (existing) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = ADFIT_SDK_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => resolve(); // 실패해도 resolve (폴백이 또 실패하면 빈 슬롯)
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
