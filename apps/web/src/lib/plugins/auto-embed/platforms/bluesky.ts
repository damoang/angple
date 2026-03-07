import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Bluesky 임베딩 플랫폼 (iframe 방식)
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
        const embedUrl = `https://embed.bsky.app/embed/${info.params?.handle}/app.bsky.feed.post/${info.id}`;

        return `<iframe
			src="${embedUrl}"
			title="Bluesky post"
			frameborder="0"
			scrolling="no"
			sandbox="allow-scripts allow-same-origin allow-popups"
			style="width: 100%; min-height: 300px; max-height: 600px; border: none; border-radius: 8px;"
		></iframe>`;
    }
};
