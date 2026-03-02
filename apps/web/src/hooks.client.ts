import type { HandleClientError } from '@sveltejs/kit';

const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';

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
 * 배포 후 chunk 로드 실패 감지 및 자동 새로고침
 * - 새 배포 시 이전 JS chunk 파일명이 변경되어 404 발생
 * - 사용자에게 캐시 초기화를 요구하지 않고 자동으로 페이지 새로고침
 */
const RELOAD_KEY = '__angple_reload_attempt__';

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

// SvelteKit 에러 훅 (라우트 에러, 로드 에러 등)
export const handleError: HandleClientError = ({ error, event, status }) => {
    const err = error instanceof Error ? error : new Error(String(error));

    // 배포 후 chunk 로드 실패 → 자동 새로고침 (1회만)
    if (isChunkLoadError(error)) {
        const lastReload = sessionStorage.getItem(RELOAD_KEY);
        const now = Date.now();
        // 마지막 새로고침으로부터 30초 이내면 중복 방지
        if (!lastReload || now - Number(lastReload) > 30_000) {
            sessionStorage.setItem(RELOAD_KEY, String(now));
            window.location.reload();
            return;
        }
    }

    sendDantry({
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
        sendDantry({
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
        const payload: Record<string, unknown> = {
            type: event.type,
            reason: String(event.reason ?? '(unknown)'),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        if (event.reason instanceof Error) {
            payload.stack = event.reason.stack;
        }
        sendDantry(payload);
    });
}
