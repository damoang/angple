/**
 * 게임 순위 API 본문 읽기 — JSON 만, 상한을 넘으면 다 읽기 전에 끊는다(청크 전송 포함).
 */
import { describe, it, expect } from 'vitest';
import { readJsonBody } from './body';

const URL_ = 'http://localhost/api/games/breakout/finish';

/** 64KB 조각을 n 개 흘려보내는 스트림 — 몇 조각을 실제로 꺼냈는지 센다 */
function chunked(n: number) {
    const state = { pulled: 0, cancelled: false };
    const chunk = new Uint8Array(64 * 1024).fill(0x61);
    const stream = new ReadableStream<Uint8Array>({
        pull(ctrl) {
            if (state.pulled >= n) {
                ctrl.close();
                return;
            }
            state.pulled++;
            ctrl.enqueue(chunk);
        },
        cancel() {
            state.cancelled = true;
        }
    });
    return { stream, state };
}

function post(body: BodyInit | null, headers: Record<string, string>): Request {
    return new Request(URL_, { method: 'POST', body, headers, duplex: 'half' } as RequestInit);
}

describe('readJsonBody', () => {
    it('application/json 이 아니면 415', async () => {
        expect(await readJsonBody(post('{}', {}), 1024)).toMatchObject({ ok: false, status: 415 });
        expect(
            await readJsonBody(post('{}', { 'content-type': 'text/plain' }), 1024)
        ).toMatchObject({ ok: false, status: 415 });
    });

    it('charset 이 붙어도 JSON 이면 읽는다', async () => {
        const r = await readJsonBody(
            post('{"a":1}', { 'content-type': 'application/json; charset=utf-8' }),
            1024
        );
        expect(r).toEqual({ ok: true, text: '{"a":1}' });
    });

    it('선언된 길이가 상한을 넘으면 읽지 않고 413', async () => {
        const r = await readJsonBody(
            post('{}', { 'content-type': 'application/json', 'content-length': '5000' }),
            1024
        );
        expect(r).toMatchObject({ ok: false, status: 413 });
    });

    it('길이 없는(청크) 본문도 상한을 넘는 순간 끊는다 — 나머지는 꺼내지 않는다', async () => {
        const { stream, state } = chunked(100); // 6.4MB
        const r = await readJsonBody(post(stream, { 'content-type': 'application/json' }), 100_000);
        expect(r).toMatchObject({ ok: false, status: 413, error: 'too_large' });
        expect(state.pulled).toBeLessThan(10);
    });

    it('상한 안이면 그대로', async () => {
        const { stream } = chunked(2);
        const r = await readJsonBody(post(stream, { 'content-type': 'application/json' }), 200_000);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.text.length).toBe(128 * 1024);
    });
});
