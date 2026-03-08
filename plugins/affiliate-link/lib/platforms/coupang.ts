/**
 * 쿠팡 제휴 링크 변환기
 * HMAC-SHA256 서명 기반 API 호출
 */

import { createHmac } from 'crypto';
import type { PlatformConverter, ConvertContext } from '../types';
import { PLATFORM_DOMAINS, matchesPlatform } from '../domain-matcher';
const env = process.env;

const API_ENDPOINT = 'https://api-gateway.coupang.com';
const API_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';

/**
 * 쿠팡 API 서명 생성
 */
function generateSignature(datetime: string, method: string, path: string): string {
	const secretKey = env.AFFI_COUPANG_SECRET_KEY || '';
	const message = `${datetime}${method}${path}`;
	return createHmac('sha256', secretKey).update(message).digest('hex');
}

/**
 * 쿠팡 단축 URL에서 원본 URL 추출
 */
async function resolveShortUrl(url: string): Promise<string> {
	// link.coupang.com/re/AFFSDP?... 형태에서 pageKey 추출
	const affsdpMatch = url.match(/link\.coupang\.com\/re\/AFFSDP.*?pageKey=([^&]+)/i);
	if (affsdpMatch) {
		return `https://www.coupang.com/vp/products/${affsdpMatch[1]}`;
	}

	// link.coupang.com/a/xxx 또는 coupa.ng/xxx 형태는 리다이렉트 따라가기
	if (/link\.coupang\.com\/a\/|coupa\.ng\//i.test(url)) {
		try {
			const response = await fetch(url, {
				method: 'HEAD',
				redirect: 'follow',
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; DamoangBot/1.0)'
				}
			});
			const finalUrl = response.url;
			if (finalUrl.includes('coupang.com')) {
				return finalUrl;
			}
		} catch {
			// 리다이렉트 실패 시 원본 반환
		}
	}

	return url;
}

/**
 * 쿠팡 API 호출
 */
async function callCoupangApi(originalUrl: string): Promise<string | null> {
	const accessKey = env.AFFI_COUPANG_ACCESS_KEY;
	const secretKey = env.AFFI_COUPANG_SECRET_KEY;

	if (!accessKey || !secretKey) {
		console.warn('[Coupang] API 키가 설정되지 않음');
		return null;
	}

	// 단축 URL 해결
	const resolvedUrl = await resolveShortUrl(originalUrl);

	// GMT 타임스탬프 생성
	const now = new Date();
	const datetime =
		now.getUTCFullYear().toString().slice(2) +
		String(now.getUTCMonth() + 1).padStart(2, '0') +
		String(now.getUTCDate()).padStart(2, '0') +
		'T' +
		String(now.getUTCHours()).padStart(2, '0') +
		String(now.getUTCMinutes()).padStart(2, '0') +
		String(now.getUTCSeconds()).padStart(2, '0') +
		'Z';

	const method = 'POST';
	const signature = generateSignature(datetime, method, API_PATH);

	const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

	const requestBody = {
		coupangUrls: [resolvedUrl]
	};

	try {
		const response = await fetch(`${API_ENDPOINT}${API_PATH}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				Authorization: authorization
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			console.error(`[Coupang] API 오류: ${response.status}`);
			return null;
		}

		const data = await response.json();

		if (data.rCode === '0' && data.data?.[0]?.shortenUrl) {
			return data.data[0].shortenUrl;
		}

		console.warn('[Coupang] 변환 실패:', data.rMessage || 'Unknown error');
		return null;
	} catch (error) {
		console.error('[Coupang] API 호출 실패:', error);
		return null;
	}
}

export const coupangConverter: PlatformConverter = {
	platform: 'coupang',
	info: PLATFORM_DOMAINS.coupang,

	matches(url: string): boolean {
		return matchesPlatform(url, 'coupang');
	},

	async convert(url: string, _context?: ConvertContext): Promise<string | null> {
		return callCoupangApi(url);
	}
};
