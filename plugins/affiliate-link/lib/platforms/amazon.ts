/**
 * 아마존 제휴 링크 변환기
 * 로컬 처리 (API 호출 없음) - tag 파라미터 추가
 */

import type { PlatformConverter, ConvertContext } from '../types';
import { PLATFORM_DOMAINS, matchesPlatform } from '../domain-matcher';
import { env } from '$env/dynamic/private';

/**
 * 아마존 URL에 제휴 태그 추가
 */
function addAmazonTag(originalUrl: string): string | null {
	const storeId = env.AFFI_AMAZON_STORE_ID || 'damoang0c-20';

	try {
		// HTML 엔티티 디코드 (단일 패스로 이중 언이스케이프 방지)
		const entityMap: Record<string, string> = { '&amp;': '&', '&#x3D;': '=', '&#x26;': '&' };
		const decodedUrl = originalUrl.replace(/&amp;|&#x3D;|&#x26;/g, (m) => entityMap[m]);

		const url = new URL(decodedUrl);

		// 기존 tag 파라미터 제거 후 새 태그 추가
		url.searchParams.delete('tag');
		url.searchParams.set('tag', storeId);

		return url.toString();
	} catch (error) {
		console.error('[Amazon] URL 파싱 실패:', error);
		return null;
	}
}

export const amazonConverter: PlatformConverter = {
	platform: 'amazon',
	info: PLATFORM_DOMAINS.amazon,

	matches(url: string): boolean {
		return matchesPlatform(url, 'amazon');
	},

	async convert(url: string, _context?: ConvertContext): Promise<string | null> {
		// 로컬 처리 (동기적이지만 인터페이스 일관성을 위해 Promise 반환)
		return addAmazonTag(url);
	}
};
