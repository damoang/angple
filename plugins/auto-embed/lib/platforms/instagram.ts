import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Instagram 임베딩 플랫폼
 * 지원: 포스트(p), 릴스(reel)
 */
export const instagram: EmbedPlatform = {
    name: 'instagram',
    patterns: [
        /(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
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
                    aspectRatio: isReel ? 177.78 : 100,
                    maxWidth: isReel ? 400 : 540
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        const embedUrl = `https://www.instagram.com/${info.platform === 'instagram-reel' ? 'reel' : 'p'}/${info.id}/embed/captioned/`;

        return `<iframe src="${embedUrl}" title="Instagram embed" frameborder="0" scrolling="no" allowtransparency="true" allowfullscreen></iframe>`;
    }
};
