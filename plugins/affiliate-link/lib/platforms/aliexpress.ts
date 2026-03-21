/**
 * 알리익스프레스 제휴 링크 변환기
 * SHA256 서명 기반 API 호출
 */

import { createHmac } from 'crypto';
import type { PlatformConverter, ConvertContext } from '../types';
import { PLATFORM_DOMAINS, matchesPlatform } from '../domain-matcher';
const env = process.env;

const API_ENDPOINT = 'https://api-sg.aliexpress.com/sync';
const API_METHOD = 'aliexpress.affiliate.link.generate';
const ALIEXPRESS_SHORT_TIMEOUT_MS = 2000;
const ALIEXPRESS_API_TIMEOUT_MS = 3000;

/**
 * 알리익스프레스 API 서명 생성
 */
function generateSignature(params: Record<string, string>): string {
	const secretKey = env.AFFI_ALIEXPRESS_SECRET_KEY || '';
	// 파라미터 정렬
	const sortedKeys = Object.keys(params).sort();

	// key + value 연결
	let signString = '';
	for (const key of sortedKeys) {
		signString += key + params[key];
	}

	// HMAC-SHA256 서명
	return createHmac('sha256', secretKey).update(signString).digest('hex').toUpperCase();
}

/**
 * 알리익스프레스 단축 URL에서 원본 URL 추출
 */
async function resolveShortUrl(url: string): Promise<string> {
	// s.click.aliexpress.com, click.aliexpress.com, a.aliexpress.com 형태
	if (/s\.click\.aliexpress\.com|click\.aliexpress\.com|a\.aliexpress\.com/i.test(url)) {
		try {
			const response = await fetch(url, {
				method: 'HEAD',
				redirect: 'follow',
				signal: AbortSignal.timeout(ALIEXPRESS_SHORT_TIMEOUT_MS),
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; DamoangBot/1.0)'
				}
			});
			const finalUrl = response.url;
			if (finalUrl.includes('aliexpress.com')) {
				// 기존 제휴 파라미터 제거
				const cleaned = finalUrl
					.replace(/[?&]aff_[^&]*/gi, '')
					.replace(/[?&]pdp_npi[^&]*/gi, '')
					.replace(/[?&]utparam[^&]*/gi, '')
					.replace(/\?&/, '?')
					.replace(/&&+/g, '&')
					.replace(/[?&]$/, '');
				return cleaned;
			}
		} catch {
			// 리다이렉트 실패 시 원본 반환
		}
	}

	return url;
}

/**
 * 알리익스프레스 API 호출
 */
async function callAliExpressApi(originalUrl: string): Promise<string | null> {
	const accessKey = env.AFFI_ALIEXPRESS_ACCESS_KEY;
	const secretKey = env.AFFI_ALIEXPRESS_SECRET_KEY;

	if (!accessKey || !secretKey) {
		console.warn('[AliExpress] API 키가 설정되지 않음');
		return null;
	}

	// 단축 URL 해결
	const resolvedUrl = await resolveShortUrl(originalUrl);

	// ko.aliexpress.com → www.aliexpress.com 변환 (API가 ko 거부)
	const processedUrl = resolvedUrl.replace('ko.aliexpress.com', 'www.aliexpress.com');

	// GMT 타임스탬프
	const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '').replace('T', ' ');

	const params: Record<string, string> = {
		method: API_METHOD,
		app_key: accessKey,
		timestamp: timestamp,
		format: 'json',
		v: '2.0',
		sign_method: 'sha256',
		source_values: processedUrl,
		promotion_link_type: '2', // 딥링크
		tracking_id: 'damoang'
	};

	// 서명 생성
	params.sign = generateSignature(params);

	try {
		const response = await fetch(API_ENDPOINT, {
			method: 'POST',
			signal: AbortSignal.timeout(ALIEXPRESS_API_TIMEOUT_MS),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
			},
			body: new URLSearchParams(params).toString()
		});

		if (!response.ok) {
			console.error(`[AliExpress] API 오류: ${response.status}`);
			return null;
		}

		const data = await response.json();

		// 응답 구조: aliexpress_affiliate_link_generate_response.resp_result.result.promotion_links.promotion_link[0].promotion_link
		const result =
			data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links
				?.promotion_link?.[0]?.promotion_link;

		if (result) {
			return result;
		}

		console.warn('[AliExpress] conversion miss:', {
			originalUrl,
			processedUrl,
			response: data
		});
		return null;
	} catch (error) {
		if (error instanceof Error && error.name === 'TimeoutError') {
			console.warn('[AliExpress] API timeout:', {
				originalUrl,
				timeoutMs: ALIEXPRESS_API_TIMEOUT_MS
			});
			return null;
		}
		console.error('[AliExpress] API 호출 실패:', error);
		return null;
	}
}

export const aliexpressConverter: PlatformConverter = {
	platform: 'aliexpress',
	info: PLATFORM_DOMAINS.aliexpress,

	matches(url: string): boolean {
		return matchesPlatform(url, 'aliexpress');
	},

	async convert(url: string, _context?: ConvertContext): Promise<string | null> {
		return callAliExpressApi(url);
	}
};
