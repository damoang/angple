import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * SvelteKit Server Hooks
 *
 * CORS 설정: Admin 앱에서 Web API 호출 허용
 * CSP 설정: XSS 및 데이터 인젝션 공격 방지
 */

/** Content-Security-Policy 헤더 생성 */
function buildCsp(): string {
	const directives: string[] = [
		"default-src 'self'",
		// SvelteKit은 인라인 스크립트를 사용하므로 unsafe-inline 필요
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
		"font-src 'self' https://cdn.jsdelivr.net",
		"img-src 'self' data: https:",
		"connect-src 'self' http://localhost:* ws://localhost:*",
		"frame-ancestors 'self'",
		"base-uri 'self'",
		"form-action 'self'"
	];

	return directives.join('; ');
}

const cspHeader = buildCsp();

export const handle: Handle = async ({ event, resolve }) => {
	// OPTIONS 요청 (CORS preflight) 처리
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	const response = await resolve(event);

	// CORS 헤더
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

	// 보안 헤더
	if (!dev) {
		response.headers.set('Content-Security-Policy', cspHeader);
	}
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
