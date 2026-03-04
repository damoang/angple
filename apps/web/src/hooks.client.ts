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
 * Chunk error 시 자동 새로고침 (최대 1회)
 * sessionStorage 카운터로 무한 루프 방지
 */
const RELOAD_KEY = '__angple_chunk_reload_count__';

function tryChunkReload(): void {
    const count = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (count < 1) {
        sessionStorage.setItem(RELOAD_KEY, String(count + 1));
        window.location.reload();
    } else {
        // 1회 재시도 후에도 실패하면 카운터 리셋하고 포기
        sessionStorage.removeItem(RELOAD_KEY);
        console.error('[Angple] Chunk load failed after retry. Please clear browser cache.');
    }
}

// 성공적으로 페이지 로드되면 카운터 리셋
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        sessionStorage.removeItem(RELOAD_KEY);
    });
}

// SvelteKit 에러 훅 (라우트 에러, 로드 에러 등)
export const handleError: HandleClientError = ({ error, event, status }) => {
    const err = error instanceof Error ? error : new Error(String(error));

    // 배포 후 chunk 로드 실패 → 자동 새로고침 (1회만)
    if (isChunkLoadError(error)) {
        tryChunkReload();
        return;
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
