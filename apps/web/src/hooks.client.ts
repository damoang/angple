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

function clearCachesAndReload(): void {
    // SW 해제 + Cache Storage 전체 삭제 후 캐시 무시 리로드
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
        // cache-busting query로 브라우저 캐시 우회
        const url = location.href.split('?')[0];
        location.replace(url + '?_v=' + Date.now());
    });
}

function tryChunkReload(): void {
    const count = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (count < 2) {
        sessionStorage.setItem(RELOAD_KEY, String(count + 1));
        clearCachesAndReload();
    } else {
        sessionStorage.removeItem(RELOAD_KEY);
        showUpdateNotice();
    }
}

function showUpdateNotice(): void {
    if (document.getElementById('__angple_update_banner__')) return;
    const banner = document.createElement('div');
    banner.id = '__angple_update_banner__';
    banner.setAttribute(
        'style',
        'position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:#2563eb;color:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)'
    );
    banner.innerHTML = `
        <span>새 버전이 배포되었습니다. 새로고침하면 최신 버전으로 이용할 수 있습니다.</span>
        <button id="__angple_update_reload__" style="padding:5px 16px;font-size:13px;cursor:pointer;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:transparent;color:white;font-weight:500;white-space:nowrap">새로고침</button>
        <button id="__angple_update_close__" style="padding:2px 6px;font-size:18px;cursor:pointer;border:none;background:transparent;color:white;line-height:1" aria-label="닫기">&times;</button>`;
    document.body.prepend(banner);
    document.getElementById('__angple_update_reload__')?.addEventListener('click', () => {
        clearCachesAndReload();
    });
    document.getElementById('__angple_update_close__')?.addEventListener('click', () => {
        banner.remove();
    });
}

// 성공적으로 페이지 로드 + hydration 완료 후 카운터 리셋
// load 직후 제거하면 hydration 중 chunk error로 카운터가 리셋되어 무한 리로드 발생
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            sessionStorage.removeItem(RELOAD_KEY);
        }, 10000);
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
