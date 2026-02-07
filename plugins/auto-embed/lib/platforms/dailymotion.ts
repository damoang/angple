import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Dailymotion 임베딩 플랫폼
 */
export const dailymotion: EmbedPlatform = {
    name: 'dailymotion',
    patterns: [/(?:www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)/],

    extract(url: string): EmbedInfo | null {
        const match = url.match(/(?:www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
        if (match) {
            return {
                platform: 'dailymotion',
                id: match[1],
                url,
                aspectRatio: 56.25
            };
        }
        return null;
    },

    render(info: EmbedInfo): string {
        return `<iframe src="https://www.dailymotion.com/embed/video/${info.id}" title="Dailymotion video player" frameborder="0" allow="autoplay" allowfullscreen></iframe>`;
    }
};
