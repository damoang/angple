import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { memoPresence } from './memo-presence.svelte';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function targetsResponse(targets: string[], truncated = false): Response {
    return jsonResponse({
        success: true,
        data: { targets, count: targets.length, truncated }
    });
}

describe('memoPresence targets', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        memoPresence.reset();
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        memoPresence.reset();
    });

    it('목록 조회 실패 시 filterIds 는 입력을 그대로 돌려준다(기존 동작)', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: false }, 500));
        const ids = ['a', 'b', 'c'];
        expect(await memoPresence.filterIds(ids)).toEqual(ids);
    });

    it('엔드포인트가 없을 때(404)도 입력을 그대로 돌려준다', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: false }, 404));
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('네트워크 예외 시 입력을 그대로 돌려준다', async () => {
        fetchMock.mockRejectedValue(new Error('network'));
        expect(await memoPresence.filterIds(['a'])).toEqual(['a']);
    });

    it('truncated 응답이면 입력을 그대로 돌려준다', async () => {
        fetchMock.mockResolvedValue(targetsResponse(['a'], true));
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('겹치는 ID 만 돌려준다', async () => {
        fetchMock.mockResolvedValue(targetsResponse(['b', 'x']));
        expect(await memoPresence.filterIds(['a', 'b', 'c'])).toEqual(['b']);
    });

    it('겹치는 ID 가 없으면 빈 배열', async () => {
        fetchMock.mockResolvedValue(targetsResponse(['x']));
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual([]);
    });

    it('동시 호출해도 목록 조회는 1번이고, 이후 호출도 다시 부르지 않는다', async () => {
        fetchMock.mockResolvedValue(targetsResponse(['a']));
        const [r1, r2, r3] = await Promise.all([
            memoPresence.ensureTargets(),
            memoPresence.filterIds(['a', 'b']),
            memoPresence.ensureTargets()
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/members/me/memo-targets');
        expect(r1 && [...r1]).toEqual(['a']);
        expect(r2).toEqual(['a']);
        expect(r3 && [...r3]).toEqual(['a']);

        await memoPresence.filterIds(['a']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('실패도 세션당 1번만 시도한다', async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, 500));
        await memoPresence.filterIds(['a']);
        await memoPresence.filterIds(['a']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('401 은 확정하지 않아 다음에 다시 묻는다', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
        fetchMock.mockResolvedValueOnce(targetsResponse(['a']));
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a', 'b']);
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a']);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('markCreated(id) 는 대상 목록에 넣고 hasAny 를 true 로 만든다', async () => {
        fetchMock.mockResolvedValue(targetsResponse([]));
        memoPresence.note(false);
        expect(memoPresence.canSkip).toBe(true);
        expect(await memoPresence.filterIds(['a'])).toEqual([]);

        memoPresence.markCreated('a');
        expect(memoPresence.canSkip).toBe(false);
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a']);
    });

    it('인자 없는 markCreated() 는 기존처럼 hasAny 만 바꾼다', async () => {
        fetchMock.mockResolvedValue(targetsResponse(['x']));
        memoPresence.note(false);
        memoPresence.markCreated();
        expect(memoPresence.canSkip).toBe(false);
        expect(await memoPresence.filterIds(['a'])).toEqual([]);
    });

    it('markDeleted(id) 는 대상 목록에서 뺀다', async () => {
        fetchMock.mockResolvedValue(targetsResponse(['a', 'b']));
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a', 'b']);
        memoPresence.markDeleted('a');
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['b']);
    });

    it('목록을 모를 때 markCreated/markDeleted 는 필터를 만들지 않는다', async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, 500));
        memoPresence.markCreated('a');
        memoPresence.markDeleted('b');
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('reset() 은 hasAny 와 대상 목록을 비우고 다시 조회하게 한다', async () => {
        fetchMock.mockResolvedValueOnce(targetsResponse(['a']));
        fetchMock.mockResolvedValueOnce(targetsResponse(['b']));
        memoPresence.note(false);
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['a']);

        memoPresence.reset();
        expect(memoPresence.canSkip).toBe(false);
        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['b']);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('reset() 전에 시작된 조회 결과는 다음 회원에게 반영되지 않는다', async () => {
        let resolveFirst!: (r: Response) => void;
        fetchMock.mockImplementationOnce(
            () =>
                new Promise<Response>((resolve) => {
                    resolveFirst = resolve;
                })
        );
        fetchMock.mockResolvedValueOnce(targetsResponse(['b']));

        const stale = memoPresence.ensureTargets();
        memoPresence.reset();
        resolveFirst(targetsResponse(['a']));
        await stale;

        expect(await memoPresence.filterIds(['a', 'b'])).toEqual(['b']);
    });

    it('빈 입력은 조회 없이 빈 배열', async () => {
        expect(await memoPresence.filterIds([])).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
