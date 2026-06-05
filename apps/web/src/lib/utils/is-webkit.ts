/**
 * 클라이언트 WebKit 엔진 판별 (브라우저 전용 — navigator 사용).
 *
 * WebKit = iOS 전 브라우저(iOS 는 모든 브라우저가 WebKit 강제) + macOS/iPadOS Safari.
 * app.html 인라인 `isWebKitEngine()` 과 동일 로직이다. 인라인 스크립트는 모듈 import 가
 * 불가해 별도로 유지하므로, 로직 변경 시 양쪽을 함께 수정해야 한다.
 *
 * 용도: WebKit MPA Fallback — `goto()` 등 프로그래매틱 내비를 full-document 로 전환
 * (#989/#796 류 WebKit bfcache/history 오염 회피). `<a>` 클릭은 app.html 의
 * data-sveltekit-reload 가 네이티브로 처리한다.
 */
export function isWebKitEngine(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    // iOS: iPhone/iPad/iPod, 또는 iPadOS 데스크탑 모드('Macintosh' 위장)는 터치포인트로 보정.
    const iOS =
        /iP(ad|hone|od)/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // macOS Safari: AppleWebKit+Safari 이면서 Chromium/Gecko/Android 계열이 아님.
    const macSafari =
        /AppleWebKit/.test(ua) &&
        /Safari/.test(ua) &&
        !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR|OPiOS|SamsungBrowser|Android)/.test(ua);
    return iOS || macSafari;
}
