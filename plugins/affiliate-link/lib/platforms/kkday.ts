/**
 * KKday 제휴 링크 변환기
 * 로컬 처리 (API 호출 없음) - cid 파라미터 추가
 */

import type { PlatformConverter, ConvertContext } from '../types';
import { PLATFORM_DOMAINS, matchesPlatform } from '../domain-matcher';
const env = process.env;

/**
 * KKday URL에 제휴 CID 추가
 */
function addKKdayCid(originalUrl: string): string | null {
	const cid = env.AFFI_KKDAY_CID || '20907';

	try {
		// HTML 엔티티 디코드
		const decodedUrl = originalUrl
			.replace(/&amp;/g, '&')
			.replace(/&#x3D;/g, '=')
			.replace(/&#x26;/g, '&');

		const url = new URL(decodedUrl);

		// 기존 cid 파라미터 제거 후 새 CID 추가
		url.searchParams.delete('cid');
		url.searchParams.set('cid', cid);

		return url.toString();
	} catch (error) {
		console.error('[KKday] URL 파싱 실패:', error);
		return null;
	}
}

export const kkdayConverter: PlatformConverter = {
	platform: 'kkday',
	info: PLATFORM_DOMAINS.kkday,

	matches(url: string): boolean {
		return matchesPlatform(url, 'kkday');
	},

	async convert(url: string, _context?: ConvertContext): Promise<string | null> {
		// 로컬 처리 (동기적이지만 인터페이스 일관성을 위해 Promise 반환)
		return addKKdayCid(url);
	}
};
