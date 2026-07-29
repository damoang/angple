/**
 * 관리자 전용 heap snapshot 다운로드 API
 *
 * GET /api/admin/heap-snapshot
 *
 * V8 의 `getHeapSnapshot()` 으로 Readable stream 을 생성하고
 * 그대로 HTTP 응답으로 스트리밍 → 메모리 spike 없이 큰 snapshot 가능.
 *
 * 사용:
 *   curl -H "Cookie: angple_sid=<admin_session>" \
 *     https://damoang.net/api/admin/heap-snapshot \
 *     -o pod-$(hostname)-$(date +%s).heapsnapshot
 *   # → Chrome DevTools 의 Memory 탭에서 분석
 *
 * 주의:
 * - snapshot 생성 중 5-30초 동안 V8 GC pause 발생 (idle pod 권장)
 * - snapshot 파일 크기 ~heapUsed 와 비슷 (수백 MB)
 *
 * ⛔ 2026-07-29: 이 파일에는 "hooks.server.ts 가 /api/admin/* 에서 admin 권한을
 *    검증한다"고 적혀 있었으나 **그런 가드는 없었다.** 훅에도, 이 핸들러에도 없었다.
 *    즉 누구나 운영 파드의 힙 스냅샷을 받아갈 수 있었다 — 프로세스 메모리에는
 *    세션 토큰·DB 자격·JWT 시크릿이 그대로 들어 있고, 생성 자체가 수십 초 GC pause 와
 *    수백 MB 를 유발해 OOM 유도까지 된다.
 *    지금은 훅 가드를 실제로 만들었고, 아래에 라우트 자체 가드도 둔다.
 *    ⛔ "훅이 막아준다"고 믿고 이 가드를 지우지 말 것. 그 믿음이 이 구멍을 만들었다.
 */

import { Readable } from 'node:stream';
import { getHeapSnapshot } from 'node:v8';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/require-admin.js';

export const GET: RequestHandler = async ({ locals }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    const stream: NodeJS.ReadableStream = getHeapSnapshot();
    const filename = `heap-${process.env.HOSTNAME || 'pod'}-${Date.now()}.heapsnapshot`;

    // Node Readable → Web ReadableStream (SvelteKit Response 호환)
    const webStream = Readable.toWeb(stream as Readable) as unknown as ReadableStream;

    return new Response(webStream, {
        status: 200,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex'
        }
    });
};
