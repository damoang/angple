import type { RequestHandler } from './$types';

/**
 * 이미지 최적화 프록시 엔드포인트
 *
 * 쿼리 파라미터:
 * - url: 원본 이미지 URL
 * - w: 리사이즈 너비 (선택)
 * - f: 출력 포맷 (webp, avif, 원본 유지)
 *
 * TODO: sharp 라이브러리 통합으로 서버 사이드 이미지 변환 구현
 * 현재는 원본 이미지를 프록시하면서 캐시 헤더만 추가합니다.
 */

const ALLOWED_ORIGINS = ['localhost', '127.0.0.1', 'damoang.net', 'angple.com'];
const MAX_WIDTH = 2560;
const CACHE_MAX_AGE = 60 * 60 * 24 * 7; // 7일
const FETCH_TIMEOUT_MS = 5000; // 5s — hang 시 heap retain 방지
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — 외부 이미지 최대 크기 cap

export const GET: RequestHandler = async ({ url, fetch }) => {
    const imageUrl = url.searchParams.get('url');
    const width = Math.min(Number(url.searchParams.get('w')) || 0, MAX_WIDTH);
    const format = url.searchParams.get('f') || '';

    if (!imageUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    // URL 보안 검증
    try {
        const parsed = new URL(imageUrl);
        const isAllowed = ALLOWED_ORIGINS.some(
            (origin) => parsed.hostname === origin || parsed.hostname.endsWith(`.${origin}`)
        );
        if (!isAllowed) {
            return new Response('Forbidden origin', { status: 403 });
        }
    } catch {
        return new Response('Invalid URL', { status: 400 });
    }

    try {
        // AbortSignal.timeout: 외부 이미지 hang 시 5s 후 강제 중단 → heap body retain 방지
        const response = await fetch(imageUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (!response.ok) {
            return new Response('Image fetch failed', { status: response.status });
        }

        // Content-Length 사전 검증 — 헤더만으로 큰 응답 거부 (1차 방어)
        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
            const declaredLength = Number(contentLengthHeader);
            if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
                return new Response('Image too large', { status: 413 });
            }
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // 스트리밍 다운로드 + 누적 size 추적 — Content-Length 가 없거나 거짓말일 때 2차 방어
        const reader = response.body?.getReader();
        if (!reader) {
            return new Response('Image fetch failed', { status: 502 });
        }

        const chunks: Uint8Array[] = [];
        let received = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    received += value.byteLength;
                    if (received > MAX_BYTES) {
                        // 이후 body 다운로드 중단 → heap 누적 차단
                        await reader.cancel().catch(() => {});
                        return new Response('Image too large', { status: 413 });
                    }
                    chunks.push(value);
                }
            }
        } finally {
            // 어떤 경로로든 reader 가 release 되도록 보장 (closure retain 방지)
            try {
                reader.releaseLock();
            } catch {
                /* noop */
            }
        }

        const body = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            body.set(chunk, offset);
            offset += chunk.byteLength;
        }

        // TODO: sharp로 리사이즈 및 포맷 변환
        // const sharp = (await import('sharp')).default;
        // let pipeline = sharp(Buffer.from(body));
        // if (width > 0) pipeline = pipeline.resize(width);
        // if (format === 'webp') pipeline = pipeline.webp({ quality: 80 });
        // if (format === 'avif') pipeline = pipeline.avif({ quality: 65 });
        // const optimized = await pipeline.toBuffer();

        return new Response(body, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
                Vary: 'Accept'
            }
        });
    } catch (err) {
        // AbortError (timeout) 와 일반 fetch 실패 구분 — 운영 디버깅용
        const isTimeout =
            err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
        if (isTimeout) {
            return new Response('Image fetch timeout', { status: 504 });
        }
        return new Response('Image processing failed', { status: 500 });
    }
};
