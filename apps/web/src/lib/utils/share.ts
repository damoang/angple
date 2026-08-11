/**
 * SNS 공유 유틸리티
 * 각 플랫폼별 share URL 생성 및 팝업 오픈
 */

function openPopup(url: string, width = 600, height = 400) {
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
}

export function shareToFacebook(url: string) {
    openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, 600, 400);
}

export function shareToX(title: string, url: string) {
    openPopup(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
        600,
        400
    );
}

export function shareToNaverBand(title: string, url: string) {
    openPopup(
        `https://www.band.us/plugin/share?body=${encodeURIComponent(`${title}\n${url}`)}`,
        600,
        500
    );
}

export function shareToNaver(title: string, url: string) {
    openPopup(
        `https://share.naver.com/web/shareView.nhn?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
        600,
        400
    );
}

export function shareToPinterest(url: string, title: string, imageUrl?: string) {
    const params = new URLSearchParams({
        url,
        description: title,
        ...(imageUrl ? { media: imageUrl } : {})
    });
    openPopup(`https://www.pinterest.com/pin/create/button/?${params.toString()}`, 750, 500);
}

export function shareToTumblr(url: string) {
    openPopup(
        `https://tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent(url)}`,
        600,
        400
    );
}

// 카카오 JS 앱키는 g5_config 에 있고 /api/config/kakao-share-key 로 런타임 조회한다(#13454).
// 예전엔 빌드타임 VITE_KAKAO_JS_KEY 를 읽어, 그 값이 비어 Kakao.init("") 로 빌드되면서
// 공유가 sharer.kakao.com "인증 실패" 였다. 이제 DB(SoT)에서 런타임으로 받는다.
let cachedKakaoKey: string | null = null;
let scriptPromise: Promise<boolean> | null = null;

declare global {
    interface Window {
        Kakao?: {
            init: (key: string) => void;
            isInitialized: () => boolean;
            Share: {
                sendDefault: (params: Record<string, unknown>) => void;
            };
        };
    }
}

/** 카카오 JS 앱키를 런타임으로 1회 조회(모듈 캐시). 없으면 빈 문자열. */
async function fetchKakaoKey(): Promise<string> {
    if (cachedKakaoKey !== null) return cachedKakaoKey;
    let key = '';
    try {
        const res = await fetch('/api/config/kakao-share-key');
        const data = res.ok ? await res.json() : null;
        key = typeof data?.key === 'string' ? data.key : '';
    } catch {
        key = '';
    }
    cachedKakaoKey = key;
    return key;
}

/** 카카오 SDK 스크립트를 한 번만 로드 */
function ensureKakaoScript(): Promise<boolean> {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/v1/kakao.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => {
            scriptPromise = null; // 실패 시 다음 시도에서 재로드 허용
            resolve(false);
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
}

async function loadKakaoSdk(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (window.Kakao?.isInitialized()) return true;

    // 키가 없으면 SDK 를 붙여도 init 이 실패하므로 먼저 확인한다.
    const key = await fetchKakaoKey();
    if (!key) return false;

    if (!window.Kakao) {
        const loaded = await ensureKakaoScript();
        if (!loaded || !window.Kakao) return false;
    }
    if (!window.Kakao.isInitialized()) {
        window.Kakao.init(key);
    }
    return window.Kakao.isInitialized();
}

export async function shareToKakao(title: string, url: string, imageUrl?: string) {
    const loaded = await loadKakaoSdk();
    if (!loaded || !window.Kakao) return false;

    window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
            title,
            imageUrl: imageUrl || '',
            link: { mobileWebUrl: url, webUrl: url }
        },
        buttons: [{ title: '웹으로 보기', link: { mobileWebUrl: url, webUrl: url } }]
    });
    return true;
}

export async function copyUrl(url: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(url);
        return true;
    } catch {
        // fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
    }
}

export async function nativeShare(title: string, url: string): Promise<boolean> {
    if (!navigator.share) return false;
    try {
        await navigator.share({ title, url });
        return true;
    } catch {
        return false;
    }
}

export function canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.share;
}
