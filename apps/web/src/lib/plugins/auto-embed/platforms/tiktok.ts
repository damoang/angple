import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * TikTok 임베딩 플랫폼
 */
export const tiktok: EmbedPlatform = {
	name: 'tiktok',
	patterns: [
		// tiktok.com/@USER/video/VIDEO_ID
		/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
		// vm.tiktok.com/VIDEO_CODE (단축 URL)
		/vm\.tiktok\.com\/([a-zA-Z0-9]+)/
	],

	extract(url: string): EmbedInfo | null {
		// 일반 URL
		const videoMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
		if (videoMatch) {
			return {
				platform: 'tiktok',
				id: videoMatch[1],
				url,
				aspectRatio: 177.78, // 9:16 세로 영상
				maxWidth: 325 // TikTok 표준 임베드 너비
			};
		}

		// 단축 URL (서버 측에서 리다이렉트 확인 필요)
		const shortMatch = url.match(/vm\.tiktok\.com\/([a-zA-Z0-9]+)/);
		if (shortMatch) {
			return {
				platform: 'tiktok',
				id: shortMatch[1],
				url,
				aspectRatio: 177.78,
				maxWidth: 325,
				params: { isShortUrl: 'true' }
			};
		}

		return null;
	},

	render(info: EmbedInfo): string {
		// TikTok은 oEmbed API를 통해 HTML을 가져오는 것이 권장됨
		// iframe 직접 임베드는 제한적
		const embedUrl = `https://www.tiktok.com/embed/v2/${info.id}`;

		return `<iframe
			src="${embedUrl}"
			title="TikTok video"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>`;
	}
};
