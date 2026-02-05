import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Vimeo 임베딩 플랫폼
 */
export const vimeo: EmbedPlatform = {
    name: 'vimeo',
    patterns: [
        // vimeo.com/VIDEO_ID
        /(?:www\.)?vimeo\.com\/(\d+)/,
        // player.vimeo.com/video/VIDEO_ID
        /player\.vimeo\.com\/video\/(\d+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const videoId = match[1];
                const params: Record<string, string> = {};

                // 해시 파라미터 추출 (비공개 비디오용)
                const hashMatch = url.match(/vimeo\.com\/\d+\/([a-f0-9]+)/);
                if (hashMatch) {
                    params.h = hashMatch[1];
                }

                return {
                    platform: 'vimeo',
                    id: videoId,
                    url,
                    aspectRatio: 56.25, // 16:9
                    params: Object.keys(params).length > 0 ? params : undefined
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        let embedUrl = `https://player.vimeo.com/video/${info.id}`;

        // 해시 파라미터 추가
        if (info.params?.h) {
            embedUrl += `?h=${info.params.h}`;
        }

        return `<iframe
			src="${embedUrl}"
			title="Vimeo video player"
			frameborder="0"
			allow="autoplay; fullscreen; picture-in-picture"
			allowfullscreen
		></iframe>`;
    }
};
