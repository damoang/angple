import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Instagram 임베딩 플랫폼
 * 지원: 포스트(p), 릴스(reel)
 */
export const instagram: EmbedPlatform = {
    name: 'instagram',
    patterns: [
        // instagram.com/p/POST_ID/
        /(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
        // instagram.com/reel/REEL_ID/
        /(?:www\.)?instagram\.com\/reel\/([a-zA-Z0-9_-]+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const contentId = match[1];
                const isReel = url.includes('/reel/');

                return {
                    platform: isReel ? 'instagram-reel' : 'instagram',
                    id: contentId,
                    url,
                    // Instagram은 정사각형 기반이지만 릴스는 세로
                    aspectRatio: isReel ? 177.78 : 100, // 9:16 vs 1:1 (약간 세로가 김)
                    maxWidth: isReel ? 400 : 540
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        // Instagram은 oEmbed blockquote 방식 사용
        // embed.js가 로드되면 blockquote를 iframe으로 변환
        const embedUrl = `https://www.instagram.com/${info.platform === 'instagram-reel' ? 'reel' : 'p'}/${info.id}/embed/captioned/`;

        return `<iframe
			src="${embedUrl}"
			title="Instagram embed"
			frameborder="0"
			scrolling="no"
			allowtransparency="true"
			allowfullscreen
		></iframe>`;
    }
};
