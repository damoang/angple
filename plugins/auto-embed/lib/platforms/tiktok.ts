import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * TikTok 임베딩 플랫폼
 */
export const tiktok: EmbedPlatform = {
    name: 'tiktok',
    patterns: [/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/, /vm\.tiktok\.com\/([a-zA-Z0-9]+)/],

    extract(url: string): EmbedInfo | null {
        const videoMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
        if (videoMatch) {
            return {
                platform: 'tiktok',
                id: videoMatch[1],
                url,
                aspectRatio: 177.78,
                maxWidth: 325
            };
        }

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
        const embedUrl = `https://www.tiktok.com/embed/v2/${info.id}`;

        return `<iframe src="${embedUrl}" title="TikTok video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
};
