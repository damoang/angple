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
 * - hooks.server.ts 가 /api/admin/* 경로에서 admin 권한 검증
 * - snapshot 생성 중 5-30초 동안 V8 GC pause 발생 (idle pod 권장)
 * - snapshot 파일 크기 ~heapUsed 와 비슷 (수백 MB)
 */

import { Readable } from 'node:stream';
import { getHeapSnapshot } from 'node:v8';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
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
