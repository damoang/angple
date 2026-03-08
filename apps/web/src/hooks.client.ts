import type { HandleClientError } from '@sveltejs/kit';

const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';

// 외부 스크립트 소스 URL 필터 (광고, 애널리틱스, 브라우저 확장)
const DENIED_SOURCES = [
    'doubleclick.net',
    'googlesyndication.com',
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.net',
    'connect.facebook.net',
    'ads.google.com',
    'pagead2.googlesyndication.com',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'edge://'
];

// 수집할 필요 없는 에러 메시지 패턴
const IGNORED_PATTERNS = [
    'Script error.',
    'runtime.sendMessage',
    'Extension context invalidated',
    'Unable to preload CSS',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'cross-origin frame',
    'zGetBack is not defined',
    '@context',
    'currentPage.innerText',
    'affiliateDomainData',
    'getBack is not defined',
    '__gCrWeb',
    'Blocked a frame',
    'querySelectorAll',
    'getAttribute',
    '.regional',
    'popover is not a function',
    'parentNode.parentNode',
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'fb_xd_fragment',
    'instantSearchSDKJSBridgeClearHighlight',
    'window.bannerNight',
    'wrsParams',
    'serviceWorker.register',
    'pubads'
];

function shouldIgnore(message: string, source?: string, stack?: string): boolean {
    // 1. 메시지 필터
    if (!message) return true;
    if (message === '[object Object]') return true;
    if (message === '(unknown)') return true;
    if (message === 'Rejected') return true;
    if (IGNORED_PATTERNS.some((p) => message.includes(p))) return true;

    // 2. 소스 URL 필터
    if (source && DENIED_SOURCES.some((d) => source.includes(d))) return true;

    // 3. 스택 트레이스 필터 (외부 스크립트에서 발생한 에러)
    if (stack && DENIED_SOURCES.some((d) => stack.includes(d))) return true;

    return false;
}

// 세션 내 동일 에러 중복 제한
const errorCounts = new Map<string, number>();
const MAX_SAME_ERROR = 5;

function shouldThrottle(message: string): boolean {
    const key = message.substring(0, 100);
    const count = errorCounts.get(key) || 0;
    if (count >= MAX_SAME_ERROR) return true;
    errorCounts.set(key, count + 1);
    return false;
}

// 전역 레이트 리밋 (1분당 최대 20건)
let sentCount = 0;
let sentResetTime = 0;
const MAX_PER_MINUTE = 20;

function isRateLimited(): boolean {
    const now = Date.now();
    if (now - sentResetTime > 60_000) {
        sentCount = 0;
        sentResetTime = now;
    }
    if (sentCount >= MAX_PER_MINUTE) return true;
    sentCount++;
    return false;
}

// 공통 전송 가드 (중복 제한 + 레이트 리밋)
function guardedSend(payload: Record<string, unknown>) {
    const msg = String(payload.message || payload.reason || '');
    if (shouldThrottle(msg)) return;
    if (isRateLimited()) return;
    sendDantry(payload);
}

function sendDantry(payload: Record<string, unknown>) {
    fetch(DANTRY_URL, {
        mode: 'cors',
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {});
}

/**
 * Chunk load error 감지
 * - 새 배포 시 이전 JS chunk 파일명이 변경되어 dynamic import 실패
 */
function isChunkLoadError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
        msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('chunkloaderror') ||
        (msg.includes('load') && msg.includes('chunk'))
    );
}

/**
 * 캐시 전체 삭제 후 리로드 (배너 새로고침 버튼에서 사용)
 */
function clearCachesAndReload(): void {
    const tasks: Promise<void>[] = [];
    if (navigator.serviceWorker) {
        tasks.push(
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.unregister());
            })
        );
    }
    if (window.caches) {
        tasks.push(
            caches.keys().then((names) => {
                names.forEach((name) => caches.delete(name));
            })
        );
    }
    Promise.all(tasks).finally(() => {
        const url = location.href.split('?')[0];
        location.replace(url + '?_v=' + Date.now());
    });
}

function showUpdateNotice(): void {
    if (document.getElementById('__angple_update_banner__')) return;
    const banner = document.createElement('div');
    banner.id = '__angple_update_banner__';
    banner.setAttribute(
        'style',
        'position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;flex-direction:column;align-items:center;padding:0;background:#2563eb;color:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)'
    );
    banner.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;width:100%">
            <span>새 버전이 배포되었습니다. 새로고침하면 최신 버전으로 이용할 수 있습니다.</span>
            <button id="__angple_update_reload__" style="padding:5px 16px;font-size:13px;cursor:pointer;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:transparent;color:white;font-weight:500;white-space:nowrap">새로고침</button>
            <button id="__angple_update_cache_help__" style="padding:5px 16px;font-size:13px;cursor:pointer;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:transparent;color:white;font-weight:500;white-space:nowrap">캐시 삭제 방법</button>
            <button id="__angple_update_close__" style="padding:2px 6px;font-size:18px;cursor:pointer;border:none;background:transparent;color:white;line-height:1" aria-label="닫기">&times;</button>
        </div>
        <div id="__angple_cache_help__" style="display:none;width:100%;padding:12px 16px;background:#1d4ed8;font-size:13px;line-height:1.6;border-top:1px solid rgba(255,255,255,0.2)">
            <div style="max-width:600px;margin:0 auto">
                <p style="margin:0 0 8px;font-weight:600">새로고침으로 해결되지 않으면 브라우저 캐시를 삭제해 주세요:</p>
                <ul style="margin:0;padding-left:20px">
                    <li><b>PC (Chrome/Edge)</b>: <kbd style="background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;font-size:12px">Ctrl + Shift + Delete</kbd> → '캐시된 이미지 및 파일' 체크 → 삭제</li>
                    <li><b>Mac (Chrome/Safari)</b>: <kbd style="background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;font-size:12px">⌘ + Shift + Delete</kbd> → 캐시 삭제</li>
                    <li><b>모바일 (Chrome)</b>: 설정 → 인터넷 사용 기록 삭제 → '캐시된 이미지 및 파일' → 삭제</li>
                    <li><b>모바일 (Safari)</b>: 설정 → Safari → 방문 기록 및 웹 사이트 데이터 지우기</li>
                </ul>
                <p style="margin:8px 0 0;opacity:0.85">캐시 삭제 후에도 문제가 지속되면 브라우저의 전체 데이터를 삭제해 보세요.</p>
            </div>
        </div>`;
    document.body.prepend(banner);
    document.getElementById('__angple_update_reload__')?.addEventListener('click', () => {
        clearCachesAndReload();
    });
    document.getElementById('__angple_update_cache_help__')?.addEventListener('click', () => {
        const help = document.getElementById('__angple_cache_help__');
        if (help) help.style.display = help.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('__angple_update_close__')?.addEventListener('click', () => {
        banner.remove();
    });
}

// app.html 통합 핸들러와 연동: exhausted 상태면 배너 표시
if (typeof window !== 'undefined') {
    // 페이지 로드 시 exhausted 체크
    const chunkError = (window as any).__angpleChunkError;
    if (chunkError) {
        const state = chunkError.getState();
        if (state.exhausted) {
            // DOM 준비 후 배너 표시
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => showUpdateNotice());
            } else {
                showUpdateNotice();
            }
        }
    }
    // 리로드 한도 초과 이벤트 수신
    window.addEventListener('angple:chunk-error-exhausted', () => {
        showUpdateNotice();
    });
}

// SvelteKit 에러 훅 (라우트 에러, 로드 에러 등)
export const handleError: HandleClientError = ({ error, event, status }) => {
    const err = error instanceof Error ? error : new Error(String(error));

    // 배포 후 chunk 로드 실패 → app.html 통합 핸들러에 위임
    if (isChunkLoadError(error)) {
        const chunkError = (window as any).__angpleChunkError;
        if (chunkError) {
            chunkError.handle();
        }
        return;
    }

    if (shouldIgnore(err.message, undefined, err.stack)) return;

    guardedSend({
        type: 'sveltekit_error',
        message: err.message,
        stack: err.stack || '(no stack)',
        url: event.url.href,
        status,
        userAgent: navigator.userAgent
    });
};

// 전역 JS 에러 (SvelteKit 밖에서 발생하는 에러)
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        if (shouldIgnore(event.message, event.filename, event.error?.stack)) return;

        guardedSend({
            type: event.type,
            message: event.message,
            source: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack || '(no stack)',
            url: window.location.href,
            userAgent: navigator.userAgent
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = String(event.reason ?? '(unknown)');
        const stack = event.reason instanceof Error ? event.reason.stack : undefined;
        if (shouldIgnore(reason, undefined, stack)) return;

        const payload: Record<string, unknown> = {
            type: event.type,
            reason,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        if (stack) {
            payload.stack = stack;
        }
        guardedSend(payload);
    });
}
