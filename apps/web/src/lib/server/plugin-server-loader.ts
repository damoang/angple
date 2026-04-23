/**
 * Server-side plugin hook loader (Phase 1A of open-core separation).
 *
 * Mirrors client-side `$lib/hooks/plugin-loader.ts` but for SSR-only hooks.
 * Client loader excludes `.server.ts`; this module INCLUDES them.
 *
 * ## Pattern: self-registering
 *
 * Plugin server hook file (`plugins/{id}/hooks/*.server.ts`):
 * ```typescript
 * import { registerHook } from '$lib/hooks/registry';
 *
 * registerHook(
 *     'post.list.enrich',
 *     async (posts) => {
 *         // e.g. attach member memos
 *         return enriched;
 *     },
 *     10,
 *     'plugin:member-memo',
 *     'filter'
 * );
 * ```
 * Just importing the file registers the hook.
 *
 * ## Open-core compliance
 *
 * 오픈소스 코어는 *어떤* hook이 등록될지 몰라도 됨. 실행할 hook이 없으면 no-op.
 * damoang 전용 플러그인 (member-memo, da-reaction 등)은 premium repo에만 존재,
 * 오픈소스 빌드 시 glob 결과가 비어있어 이 loader는 0개 hook을 로드함.
 */

// Vite glob — SSR 전용 파일만 (`.server.ts`). 클라이언트 번들 유입 방지.
const serverHooks = import.meta.glob('../../../../../plugins/**/hooks/*.server.{ts,js}');
const customServerHooks = import.meta.glob(
    '../../../../../custom-plugins/**/hooks/*.server.{ts,js}'
);

const allServerHooks = { ...serverHooks, ...customServerHooks };

/** Idempotency — 한번 로드된 경로는 재import 안 함 (singleton registry 중복 방지). */
const loadedPaths = new Set<string>();

/**
 * 발견된 모든 plugin server hook 파일을 import (self-register 실행).
 *
 * - hook 파일 없음 → no-op
 * - 일부 파일 실패 → 해당 파일만 skip, 나머지 계속 시도
 * - 이미 로드된 파일은 skip (HMR에서도 중복 등록 방지)
 *
 * 호출 시점: hooks.server.ts 모듈 load 직후 (최초 요청 전).
 */
export async function loadAllPluginServerHooks(): Promise<void> {
    for (const [path, loader] of Object.entries(allServerHooks)) {
        if (loadedPaths.has(path)) continue;
        try {
            await loader();
            loadedPaths.add(path);
        } catch (err) {
            console.error(`[Plugin Server Loader] Failed: ${path}`, err);
        }
    }
}

/** 로드된 hook 파일 수 (모니터링/디버깅용). */
export function getLoadedServerHookCount(): number {
    return loadedPaths.size;
}

/** 로드된 hook 파일 경로 리스트 (디버깅용). */
export function getLoadedServerHookPaths(): string[] {
    return Array.from(loadedPaths);
}
