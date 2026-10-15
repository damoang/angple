/**
 * 게임 순위 API 요청 본문 읽기 — 상한을 넘는 순간 읽기를 멈춘다(통째로 버퍼에 담기 전에).
 *
 * 서버 전체의 요청 본문 상한은 이 API 에 비해 훨씬 크고, 청크 전송 요청에는 content-length 가 없다.
 * 그래서 선언된 길이를 먼저 보고, 실제로 읽으면서도 바이트를 세어 넘으면 바로 끊는다.
 */

export type BodyResult =
    | { ok: true; text: string }
    | {
          ok: false;
          status: 413 | 415 | 400;
          error: 'too_large' | 'unsupported_type' | 'bad_request';
      };

/** content-type 이 application/json 인가 (charset 등 매개변수 허용) */
export function isJsonRequest(request: Request): boolean {
    const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    return type === 'application/json';
}

/** 본문을 maxBytes 까지만 읽는다. 넘으면 413, JSON 이 아니면 415 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
    if (!isJsonRequest(request)) {
        return { ok: false, status: 415, error: 'unsupported_type' };
    }
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
        return { ok: false, status: 413, error: 'too_large' };
    }
    const stream = request.body;
    if (!stream) return { ok: true, text: '' };
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel().catch(() => undefined);
                return { ok: false, status: 413, error: 'too_large' };
            }
            chunks.push(value);
        }
    } catch {
        return { ok: false, status: 400, error: 'bad_request' };
    } finally {
        reader.releaseLock?.();
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
        buf.set(c, off);
        off += c.byteLength;
    }
    try {
        return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(buf) };
    } catch {
        return { ok: false, status: 400, error: 'bad_request' };
    }
}
