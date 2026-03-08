import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * 네이버 TV 임베딩 플랫폼
 * tv.naver.com, tv.naver.com/v
 */
export const naverTv: EmbedPlatform = {
    name: 'naver-tv',
    patterns: [
        // tv.naver.com/v/VIDEO_ID
        /tv\.naver\.com\/v\/(\d+)/,
        // tv.naver.com/embed/VIDEO_ID
        /tv\.naver\.com\/embed\/(\d+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    platform: 'naver-tv',
                    id: match[1],
                    url,
                    aspectRatio: 56.25 // 16:9
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        return `<iframe
			src="https://tv.naver.com/embed/${info.id}"
			title="네이버 TV"
			frameborder="0"
			allow="autoplay; fullscreen; encrypted-media"
			allowfullscreen
		></iframe>`;
    }
};
