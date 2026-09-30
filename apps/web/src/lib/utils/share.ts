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

// bug/13991: 예전엔 레거시 v1(1.44) 경로를 버전 고정·무결성 검사 없이 불러왔다.
// 카카오 공식 다운로드 페이지(developers.kakao.com/docs/latest/ko/javascript/download)가
// 게시한 v2 정확한 버전과 integrity 값을 그대로 쓴다. 버전을 올릴 땐 두 값을 함께 바꾼다.
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
const KAKAO_SDK_INTEGRITY =
    'sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
const KAKAO_SDK_LOAD_TIMEOUT_MS = 10_000;

/** 대표 이미지가 없을 때 쓰는 기본 이미지(사이트 아이콘) 경로 */
const KAKAO_FALLBACK_IMAGE_PATH = '/icons/icon-512.png';

/** 카카오 SDK 스크립트를 한 번만 로드 */
function ensureKakaoScript(): Promise<boolean> {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (!ok) {
                scriptPromise = null; // 실패 시 다음 시도에서 재로드 허용
                script.remove();
            }
            resolve(ok);
        };
        // CDN 이 응답하지 않으면 onload/onerror 둘 다 오지 않아 버튼이 무반응이 된다.
        const timer = setTimeout(() => finish(false), KAKAO_SDK_LOAD_TIMEOUT_MS);
        script.src = KAKAO_SDK_URL;
        script.integrity = KAKAO_SDK_INTEGRITY;
        script.crossOrigin = 'anonymous';
        script.onload = () => finish(true);
        script.onerror = () => finish(false);
        document.head.appendChild(script);
    });
    return scriptPromise;
}

async function loadKakaoSdk(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
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
    } catch (err) {
        console.error('[share] 카카오 SDK 초기화 실패', err);
        return false;
    }
}

/**
 * 공유 메뉴를 열 때 미리 SDK 를 받아 둔다. 클릭 뒤 SDK 를 받느라 await 가 길어지면
 * 브라우저가 sendDefault 의 새 창을 사용자 동작이 아닌 것으로 보고 막을 수 있다.
 */
export function preloadKakaoSdk(): void {
    void loadKakaoSdk();
}

/**
 * 카카오 피드 템플릿의 content.imageUrl 은 필수다. 빈 문자열이면 공유 화면이
 * 「요청 실패」가 된다(bug/13991). 상대경로는 현재 사이트 기준 절대 https 로 바꾸고,
 * 쓸 수 없는 값이면 사이트 아이콘으로 대체한다.
 */
export function resolveKakaoImageUrl(imageUrl?: string): string {
    const origin = window.location.origin;
    const fallback = new URL(KAKAO_FALLBACK_IMAGE_PATH, origin);
    if (fallback.protocol === 'http:' && fallback.hostname !== 'localhost') {
        fallback.protocol = 'https:';
    }
    if (!imageUrl) return fallback.href;
    try {
        const parsed = new URL(imageUrl, origin);
        if (parsed.protocol === 'http:') parsed.protocol = 'https:';
        if (parsed.protocol !== 'https:') return fallback.href;
        return parsed.href;
    } catch {
        return fallback.href;
    }
}

/** 카카오톡 공유. SDK 로드·초기화·호출 중 하나라도 실패하면 false */
export async function shareToKakao(
    title: string,
    url: string,
    imageUrl?: string
): Promise<boolean> {
    const loaded = await loadKakaoSdk();
    if (!loaded || !window.Kakao?.Share?.sendDefault) return false;

    try {
        window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: title || document.title,
                imageUrl: resolveKakaoImageUrl(imageUrl),
                link: { mobileWebUrl: url, webUrl: url }
            },
            buttons: [{ title: '웹으로 보기', link: { mobileWebUrl: url, webUrl: url } }]
        });
        return true;
    } catch (err) {
        console.error('[share] 카카오톡 공유 호출 실패', err);
        return false;
    }
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
