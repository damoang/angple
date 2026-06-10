/**
 * payment HTTP 응답 헬퍼 (no @sveltejs/kit).
 *
 * plugin route 핸들러는 plugins/ 트리에 있어 `@sveltejs/kit` 값 import(json/error)가
 * 빌드(Rollup)에서 resolve 되지 않는다 — @sveltejs/kit 는 apps/web 의존성이라
 * plugins/ 에서 node 해석으로 도달 불가. (archive·brickang 과 동일하게 raw Response 사용.)
 * RequestEvent 는 타입이므로 `import type` 로만 쓰면 esbuild 가 제거하여 무해하다.
 */

/** @sveltejs/kit 의 json() 대체. */
export function json(data: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(data), { ...init, headers });
}

/** @sveltejs/kit 의 error() 대체 — JSON 본문 Response 를 throw. (`throw error(400, ...)`) */
export function error(status: number, message: string): never {
    throw new Response(JSON.stringify({ message }), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}
