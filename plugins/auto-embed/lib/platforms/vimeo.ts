import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Vimeo 임베딩 플랫폼
 */
export const vimeo: EmbedPlatform = {
    name: 'vimeo',
    patterns: [
        /(?:www\.)?vimeo\.com\/(\d+)/,
        /player\.vimeo\.com\/video\/(\d+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const videoId = match[1];
                const params: Record<string, string> = {};

                const hashMatch = url.match(/vimeo\.com\/\d+\/([a-f0-9]+)/);
                if (hashMatch) {
                    params.h = hashMatch[1];
                }

                return {
                    platform: 'vimeo',
                    id: videoId,
                    url,
                    aspectRatio: 56.25,
                    params: Object.keys(params).length > 0 ? params : undefined
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        let embedUrl = `https://player.vimeo.com/video/${info.id}`;

        if (info.params?.h) {
            embedUrl += `?h=${info.params.h}`;
        }

        return `<iframe src="${embedUrl}" title="Vimeo video player" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
};
