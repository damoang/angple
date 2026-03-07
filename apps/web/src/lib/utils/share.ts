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

let kakaoLoading = false;
let kakaoLoaded = false;

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

async function loadKakaoSdk(): Promise<boolean> {
    if (kakaoLoaded && window.Kakao?.isInitialized()) return true;
    if (kakaoLoading) {
        // 이미 로딩 중이면 대기
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (kakaoLoaded) {
                    clearInterval(check);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => {
                clearInterval(check);
                resolve(false);
            }, 5000);
        });
    }

    kakaoLoading = true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/v1/kakao.min.js';
        script.onload = () => {
            const key = import.meta.env.VITE_KAKAO_JS_KEY || '';
            if (window.Kakao && !window.Kakao.isInitialized()) {
                window.Kakao.init(key);
            }
            kakaoLoaded = true;
            kakaoLoading = false;
            resolve(true);
        };
        script.onerror = () => {
            kakaoLoading = false;
            resolve(false);
        };
        document.head.appendChild(script);
    });
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
