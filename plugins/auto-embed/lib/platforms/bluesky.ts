import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Bluesky 임베딩 플랫폼
 */
export const bluesky: EmbedPlatform = {
    name: 'bluesky',
    patterns: [/bsky\.app\/profile\/([^/]+)\/post\/(\w+)/],

    extract(url: string): EmbedInfo | null {
        const match = url.match(/bsky\.app\/profile\/([^/]+)\/post\/(\w+)/);
        if (match) {
            return {
                platform: 'bluesky',
                id: match[2],
                url,
                params: {
                    handle: match[1]
                }
            };
        }
        return null;
    },

    render(info: EmbedInfo): string {
        const postUrl = `https://bsky.app/profile/${info.params?.handle}/post/${info.id}`;

        return `<blockquote class="bluesky-embed" data-bluesky-uri="at://${info.params?.handle}/app.bsky.feed.post/${info.id}"><a href="${postUrl}">Bluesky 게시글</a></blockquote>`;
    }
};
