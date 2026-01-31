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
		const response = await fetch(imageUrl);
		if (!response.ok) {
			return new Response('Image fetch failed', { status: response.status });
		}

		const contentType = response.headers.get('content-type') || 'image/jpeg';
		const body = await response.arrayBuffer();

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
	} catch {
		return new Response('Image processing failed', { status: 500 });
	}
};
