import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const remote = vi.fn();
type LookupEvent = Parameters<typeof import('./+server').GET>[0];
function event(titles: string[]): LookupEvent {
    const url = new URL('https://damoang.net/api/wikiang/exists');
    for (const title of titles) url.searchParams.append('title', title);
    // This handler only reads url; SvelteKit's unrelated request internals are omitted in this test.
    return { url } as LookupEvent;
}

describe('위키앙 공개 API 프록시', () => {
    beforeEach(() => {
        vi.resetModules();
        remote.mockReset();
        vi.stubGlobal('fetch', remote);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('고정 공개 API로 조회하고 결과를 캐시하며 쿠키를 전달하지 않는다', async () => {
        remote.mockResolvedValue(
            Response.json({ checked: ['서울'], pages: [{ title: '서울', path: '/도시/서울' }] })
        );
        const { GET } = await import('./+server');
        expect((await GET(event(['서울']))).status).toBe(200);
        expect((await GET(event(['서울']))).status).toBe(200);
        expect(remote).toHaveBeenCalledTimes(1);
        expect(remote.mock.calls[0][0].origin).toBe('https://wikiang.org');
        expect(remote.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
        expect(remote.mock.calls[0][1].headers).toEqual({ accept: 'application/json' });
    });

    it('원격 오류를 없는 문서로 캐시하지 않고 단기 재시도 제한을 적용한다', async () => {
        remote.mockResolvedValue(new Response('', { status: 503 }));
        const { GET } = await import('./+server');
        const response = await GET(event(['서울']));
        expect(response.status).toBe(503);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({ error: 'lookup_unavailable' });
        expect((await GET(event(['다른문서']))).status).toBe(503);
        expect(remote).toHaveBeenCalledTimes(1);
    });

    it('부분 응답과 과다 입력은 문서 존재 결과로 사용하지 않는다', async () => {
        remote.mockResolvedValue(Response.json({ checked: [], pages: [] }));
        const { GET } = await import('./+server');
        expect((await GET(event(['서울']))).status).toBe(503);
        expect((await GET(event(Array.from({ length: 21 }, (_, i) => `문서${i}`)))).status).toBe(
            400
        );
        expect(remote).toHaveBeenCalledTimes(1);
    });
});
