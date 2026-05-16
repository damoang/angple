/**
 * Plugin Client Hook Loader — WP `add_filter`/`add_action` 클라이언트 측 자동 활성화.
 *
 * `plugins/&#42;&#42;/hooks/*.client.{ts,js}` 글로브 매칭 파일을 브라우저 부팅 시 1회
 * 동적 import → 각 파일의 top-level addFilter/addAction side-effect 가 실행된다.
 * server 측 `plugin-server-loader.ts` 의 client 짝.
 *
 * 호출 시점: `hooks.client.ts` 모듈 load 직후 (앱 최초 hydration 전).
 */

// Vite glob — `.client.ts` 만 (서버 번들 유입 차단).
const clientHooks = import.meta.glob('../../../../../plugins/**/hooks/*.client.{ts,js}');
const customClientHooks = import.meta.glob(
    '../../../../../custom-plugins/**/hooks/*.client.{ts,js}'
);

const allClientHooks = { ...clientHooks, ...customClientHooks };

/** Idempotency — 한번 로드된 경로는 재import 안 함 (singleton registry 중복 방지). */
const loadedPaths = new Set<string>();

/**
 * 모든 plugin client hooks 자동 로드.
 * 호출 시점: hooks.client.ts 모듈 load 직후 (최초 hydration 전).
 */
export async function loadAllPluginClientHooks(): Promise<void> {
    for (const [path, loader] of Object.entries(allClientHooks)) {
        if (loadedPaths.has(path)) continue;
        try {
            await loader();
            loadedPaths.add(path);
        } catch (err) {
            console.error(`[Plugin Client Loader] Failed: ${path}`, err);
        }
    }
}

/** 로드된 hook 파일 수 (모니터링/디버깅용). */
export function getLoadedClientHookCount(): number {
    return loadedPaths.size;
}

/** 로드된 hook 파일 경로 리스트 (디버깅용). */
export function getLoadedClientHookPaths(): string[] {
    return Array.from(loadedPaths);
}
