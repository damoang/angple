/**
 * 링크프라이스 제휴 링크 변환기
 * REST API 호출 (150+ 쇼핑몰 지원)
 */

import type { PlatformConverter, ConvertContext } from '../types';
import { PLATFORM_DOMAINS, matchesPlatform, LINKPRICE_MERCHANTS, extractHost } from '../domain-matcher';
const env = process.env;

const API_ENDPOINT = 'https://api.linkprice.com/ci/service/custom_link_xml';

/**
 * 클릭 ID 생성 (추적용)
 * 형식: u{mb_no}_{bo_table}_{wr_id} 또는 {bo_table}_{wr_id}
 */
function generateClickId(context?: ConvertContext): string {
	const parts: string[] = [];

	if (context?.mb_no) {
		parts.push(`u${context.mb_no}`);
	}

	if (context?.bo_table) {
		parts.push(context.bo_table);
	}

	if (context?.wr_id) {
		parts.push(String(context.wr_id));
	}

	return parts.join('_') || 'direct';
}

/**
 * 링크프라이스 API 호출
 */
async function callLinkPriceApi(originalUrl: string, context?: ConvertContext): Promise<string | null> {
	const affiliateId = env.AFFI_LINKPRICE_AFF_ID || env.AFFI_AFFILIATE_ID;

	if (!affiliateId) {
		console.warn('[LinkPrice] Affiliate ID가 설정되지 않음');
		return null;
	}

	const clickId = generateClickId(context);
	const encodedUrl = encodeURIComponent(originalUrl);

	const apiUrl = `${API_ENDPOINT}?a_id=${affiliateId}&url=${encodedUrl}&u_id=${clickId}&mode=json`;

	try {
		const response = await fetch(apiUrl, {
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; DamoangBot/1.0)'
			}
		});

		if (!response.ok) {
			console.error(`[LinkPrice] API 오류: ${response.status}`);
			return null;
		}

		const data = await response.json();

		// 응답 구조: { result: 'S', url: '변환된 URL' }
		if (data.result === 'S' && data.url) {
			let linkpriceUrl = data.url;

			// u_id가 없으면 수동 추가
			if (!linkpriceUrl.includes('&u=') && !linkpriceUrl.includes('?u=')) {
				const separator = linkpriceUrl.includes('?') ? '&' : '?';
				linkpriceUrl += `${separator}u=${encodeURIComponent(clickId)}`;
			}

			return linkpriceUrl;
		}

		console.warn('[LinkPrice] 변환 실패:', data);
		return null;
	} catch (error) {
		console.error('[LinkPrice] API 호출 실패:', error);
		return null;
	}
}

/**
 * URL이 링크프라이스 머천트인지 확인
 */
function isLinkPriceMerchant(url: string): boolean {
	// 이미 링크프라이스 단축 URL인 경우
	if (matchesPlatform(url, 'linkprice')) {
		return true;
	}

	// 머천트 도메인 확인
	const host = extractHost(url);
	if (!host) return false;

	for (const merchant of LINKPRICE_MERCHANTS) {
		if (host === merchant || host.endsWith('.' + merchant)) {
			return true;
		}
	}

	return false;
}

export const linkpriceConverter: PlatformConverter = {
	platform: 'linkprice',
	info: PLATFORM_DOMAINS.linkprice,

	matches(url: string): boolean {
		return isLinkPriceMerchant(url);
	},

	async convert(url: string, context?: ConvertContext): Promise<string | null> {
		return callLinkPriceApi(url, context);
	}
};
