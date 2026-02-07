import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Reddit 임베딩 플랫폼
 */
export const reddit: EmbedPlatform = {
    name: 'reddit',
    patterns: [
        /(?:www\.)?reddit\.com\/(r|user)\/[\w:.]{2,21}\/comments\/\w{5,9}/
    ],

    extract(url: string): EmbedInfo | null {
        const match = url.match(
            /(?:www\.)?reddit\.com\/(r|user)\/([\w:.]{2,21})\/comments\/(\w{5,9})(?:\/([\w%\\-]+))?/
        );
        if (match) {
            return {
                platform: 'reddit',
                id: match[3],
                url,
                params: {
                    type: match[1],
                    subreddit: match[2],
                    slug: match[4] || ''
                }
            };
        }
        return null;
    },

    render(info: EmbedInfo): string {
        const postUrl = `https://www.reddit.com/${info.params?.type}/${info.params?.subreddit}/comments/${info.id}${info.params?.slug ? '/' + info.params.slug : ''}`;

        return `<blockquote class="reddit-embed-bq" style="height:500px" data-embed-height="740"><a href="${postUrl}">Reddit 게시글</a></blockquote>`;
    }
};
