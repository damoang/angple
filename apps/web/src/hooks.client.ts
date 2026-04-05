import type { HandleClientError } from '@sveltejs/kit';
import { replaceState } from '$app/navigation';

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
    "Can't find variable: $",
    '$ is not defined',
    'Uncaught ReferenceError: $ is not defined',
    'jQuery is not defined',
    "Can't find variable: jQuery",
    'Uncaught ReferenceError: jQuery is not defined',
    'get_cookie',
    'customuiConfig',
    'window.customUi',
    'window.da.inspect',
    'daReactionContainer',
    '$.datepicker.regional',
    'popover is not a function',
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
    'pubads',
    'is not valid JSON',
    'Unrecognized token',
    'error loading dynamically imported module',
    'adsbygoogle.push()',
    'JSON.parse: unexpected character',
    '__firefox__',
    'window.ethereum',
    'hover` was not found',
    'Failed to update the ServiceWorker',
    'Failed to update a ServiceWorker'
];

function shouldIgnore(message: string, source?: string, stack?: string): boolean {
    // 1. 메시지 필터
    if (!message) return true;
    if (message === '[object Object]') return true;
    if (message === '(unknown)') return true;
    if (message === 'Rejected' || message === 'Error: Rejected') return true;
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
 * 강력 캐시 삭제: SW + Cache Storage + sessionStorage + 쿼리 버스팅 리로드
 */
function forceClearAllAndReload(): void {
    const tasks: Promise<void>[] = [];
    // 1. Service Worker 해제
    if (navigator.serviceWorker) {
        tasks.push(
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.unregister());
            })
        );
    }
    // 2. Cache Storage 전체 삭제
    if (window.caches) {
        tasks.push(
            caches.keys().then((names) => {
                return Promise.all(names.map((name) => caches.delete(name))).then(() => {});
            })
        );
    }
    // 3. sessionStorage 정리 (리로드 카운터 등)
    try {
        sessionStorage.clear();
    } catch (_) {}
    // 4. 쿼리 버스팅으로 완전 새 요청
    Promise.all(tasks).finally(() => {
        const url = new URL(location.href);
        url.searchParams.set('_v', String(Date.now()));
        location.replace(url.toString());
    });
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
        const url = new URL(location.href);
        url.searchParams.set('_v', String(Date.now()));
        location.replace(url.toString());
    });
}

const CHUNK_FORCE_CLEAR_KEY = '__angple_chunk_force_clear__';
const STALE_CLIENT_RECOVERY_KEY = '__angple_stale_client_recovery__';
const RECOVERY_PENDING_KEY = '__angple_recovery_pending__';

function markRecoveryPending(type: 'chunk' | 'stale', reason: string, count: number): void {
    try {
        sessionStorage.setItem(
            RECOVERY_PENDING_KEY,
            JSON.stringify({
                type,
                reason,
                count,
                ts: Date.now(),
                from: window.location.href
            })
        );
    } catch {}

    guardedSend({
        type: `${type}_recovery_started`,
        message: `${type} recovery started: ${reason}`,
        reason,
        count,
        url: window.location.href,
        userAgent: navigator.userAgent
    });
}

function flushRecoverySuccessIfNeeded(): void {
    try {
        const raw = sessionStorage.getItem(RECOVERY_PENDING_KEY);
        if (!raw) return;
        const pending = JSON.parse(raw) as {
            type?: 'chunk' | 'stale';
            reason?: string;
            count?: number;
            ts?: number;
            from?: string;
        };

        if (!pending?.type || !pending?.reason) {
            sessionStorage.removeItem(RECOVERY_PENDING_KEY);
            return;
        }

        guardedSend({
            type: `${pending.type}_recovery_succeeded`,
            message: `${pending.type} recovery succeeded: ${pending.reason}`,
            reason: pending.reason,
            count: pending.count ?? 0,
            recoveryLatencyMs: pending.ts ? Date.now() - pending.ts : null,
            recoveredFrom: pending.from || '(unknown)',
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        sessionStorage.removeItem(RECOVERY_PENDING_KEY);
    } catch {
        try {
            sessionStorage.removeItem(RECOVERY_PENDING_KEY);
        } catch {}
    }
}

function recoverChunkErrorSilently(): boolean {
    try {
        const count = Number(sessionStorage.getItem(CHUNK_FORCE_CLEAR_KEY) || '0');
        if (count >= 1) return false;
        sessionStorage.setItem(CHUNK_FORCE_CLEAR_KEY, String(count + 1));
        markRecoveryPending('chunk', 'bootstrap-chunk-error', count + 1);
    } catch {
        return false;
    }
    forceClearAllAndReload();
    return true;
}

function recoverStaleClientSilently(reason: string): boolean {
    try {
        const count = Number(sessionStorage.getItem(STALE_CLIENT_RECOVERY_KEY) || '0');
        if (count >= 1) return false;
        sessionStorage.setItem(STALE_CLIENT_RECOVERY_KEY, String(count + 1));
        markRecoveryPending('stale', reason, count + 1);
    } catch {
        return false;
    }
    forceClearAllAndReload();
    return true;
}

// app.html 통합 핸들러와 연동: exhausted 상태면 상단 배너 대신 1회 강력 새로고침
if (typeof window !== 'undefined') {
    const currentUrl = new URL(window.location.href);
    const recoveredWithCacheBust = currentUrl.searchParams.get('_v');
    if (recoveredWithCacheBust) {
        flushRecoverySuccessIfNeeded();
    }
    if (currentUrl.searchParams.has('_v')) {
        currentUrl.searchParams.delete('_v');
        replaceState(currentUrl.href, window.history.state);
    }

    const chunkError = (window as any).__angpleChunkError;
    if (chunkError) {
        const state = chunkError.getState();
        if (state.exhausted) {
            recoverChunkErrorSilently();
        }
    }
    window.addEventListener('angple:chunk-error-exhausted', () => {
        if (!recoverChunkErrorSilently()) {
            guardedSend({
                type: 'chunk_error_exhausted',
                message: 'Chunk error recovery exhausted after forced clear reload',
                url: window.location.href,
                userAgent: navigator.userAgent
            });
        }
    });
    window.addEventListener('angple:stale-client-recovery', (event) => {
        const reason =
            event instanceof CustomEvent && typeof event.detail?.reason === 'string'
                ? event.detail.reason
                : 'unknown';
        if (!recoverStaleClientSilently(reason)) {
            guardedSend({
                type: 'stale_client_recovery_exhausted',
                message: `Stale client recovery exhausted: ${reason}`,
                url: window.location.href,
                userAgent: navigator.userAgent
            });
        }
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
            message: reason,
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
