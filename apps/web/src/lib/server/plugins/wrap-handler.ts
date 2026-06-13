import type { RequestEvent } from '@sveltejs/kit';

type PluginHandler = (event: RequestEvent) => Promise<Response>;

/**
 * 플러그인 shim 어댑터.
 *
 * premium `api-routes` 의 shim(+server.ts)이 plugin route 핸들러를 노출할 때 사용한다.
 *
 * 배경: plugin route 핸들러는 `plugins/<id>/server/http.ts` 의 `error()` 가 raw `Response`
 * 를 throw 한다(`plugins/` 트리에서 `@sveltejs/kit` 를 build resolve 할 수 없어 회피).
 * route-dispatcher 경유 요청은 `.status` duck-typing 으로 이를 처리하지만, shim 경유
 * 요청은 SvelteKit 이 핸들러 throw 를 직접 받는데 thrown `Response` 를 정상 응답으로
 * 인식하지 못해 500("일시적인 오류")으로 떨어진다.
 *
 * 이 래퍼가 thrown `Response` 를 catch 하여 그대로 return → 의도한 status + JSON body 보존.
 * 그 외 예외는 재-throw 하여 SvelteKit 의 기본 500 처리에 맡긴다.
 */
export function wrapPluginHandler(fn: PluginHandler): PluginHandler {
    return async (event) => {
        try {
            return await fn(event);
        } catch (err) {
            if (err instanceof Response) return err;
            throw err;
        }
    };
}
