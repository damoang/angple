import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * YouTube 임베딩 플랫폼
 * 지원: 일반 영상, Shorts, Live, 재생목록
 */
export const youtube: EmbedPlatform = {
	name: 'youtube',
	patterns: [
		// youtube.com/watch?v=VIDEO_ID
		/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
		// youtu.be/VIDEO_ID
		/youtu\.be\/([a-zA-Z0-9_-]{11})/,
		// youtube.com/shorts/VIDEO_ID
		/(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
		// youtube.com/live/VIDEO_ID
		/(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
		// youtube.com/embed/VIDEO_ID
		/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
	],

	extract(url: string): EmbedInfo | null {
		for (const pattern of this.patterns) {
			const match = url.match(pattern);
			if (match) {
				const videoId = match[1];
				const isShorts = url.includes('/shorts/');
				const params: Record<string, string> = {};

				// 시작 시간 추출 (?t=123 또는 &t=123)
				const timeMatch = url.match(/[?&]t=(\d+)/);
				if (timeMatch) {
					params.start = timeMatch[1];
				}

				// 재생목록 ID 추출
				const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
				if (listMatch) {
					params.list = listMatch[1];
				}

				return {
					platform: isShorts ? 'youtube-shorts' : 'youtube',
					id: videoId,
					url,
					aspectRatio: isShorts ? 177.78 : 56.25, // 9:16 vs 16:9
					maxWidth: isShorts ? 400 : undefined,
					params: Object.keys(params).length > 0 ? params : undefined
				};
			}
		}
		return null;
	},

	render(info: EmbedInfo): string {
		let embedUrl = `https://www.youtube.com/embed/${info.id}`;

		// 쿼리 파라미터 추가
		const queryParams: string[] = [];
		if (info.params?.start) {
			queryParams.push(`start=${info.params.start}`);
		}
		if (info.params?.list) {
			queryParams.push(`list=${info.params.list}`);
		}
		if (queryParams.length > 0) {
			embedUrl += '?' + queryParams.join('&');
		}

		return `<iframe
			src="${embedUrl}"
			title="YouTube video player"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
			referrerpolicy="strict-origin-when-cross-origin"
			allowfullscreen
		></iframe>`;
	}
};
