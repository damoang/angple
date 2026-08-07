import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Twitter/X 임베딩 플랫폼
 */
export const twitter: EmbedPlatform = {
    name: 'twitter',
    patterns: [
        /(?:www\.)?twitter\.com\/\w+\/status\/(\d+)/,
        /(?:www\.)?x\.com\/\w+\/status\/(\d+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const tweetId = match[1];

                const userMatch = url.match(/(?:twitter|x)\.com\/(\w+)\/status/);
                const username = userMatch ? userMatch[1] : '';

                return {
                    platform: 'twitter',
                    id: tweetId,
                    url,
                    params: username ? { username } : undefined
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        const embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${info.id}&theme=light`;

        return `<iframe src="${embedUrl}" title="Twitter post" frameborder="0" scrolling="no" allowtransparency="true" allowfullscreen style="min-height: 250px;"></iframe>`;
    }
};
