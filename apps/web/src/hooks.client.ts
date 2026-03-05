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
 * Chunk error 시 자동 새로고침 (최대 2회)
 * sessionStorage 카운터로 무한 루프 방지
 * 2회 실패 시 사용자에게 새 버전 배포 안내 UI 표시
 */
const RELOAD_KEY = '__angple_chunk_reload_count__';

function tryChunkReload(): void {
    const count = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (count < 2) {
        sessionStorage.setItem(RELOAD_KEY, String(count + 1));
        window.location.reload();
    } else {
        sessionStorage.removeItem(RELOAD_KEY);
        showUpdateNotice();
    }
}

function showUpdateNotice(): void {
    document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;flex-direction:column;gap:16px;text-align:center;padding:20px;background:#fafafa;color:#333">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            <h2 style="margin:0;font-size:20px;font-weight:600">새 버전이 배포되었습니다</h2>
            <p style="margin:0;color:#666;font-size:14px">페이지를 새로고침하면 최신 버전으로 이용할 수 있습니다.</p>
            <button onclick="location.reload()" style="margin-top:8px;padding:12px 32px;font-size:15px;cursor:pointer;border-radius:8px;border:none;background:#2563eb;color:white;font-weight:500;transition:background 0.2s" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                새로고침
            </button>
        </div>`;
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

    // 배포 후 chunk 로드 실패 → 자동 새로고침 (최대 2회)
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
