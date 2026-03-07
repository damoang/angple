import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Reddit 임베딩 플랫폼 (iframe 방식)
 */
export const reddit: EmbedPlatform = {
    name: 'reddit',
    patterns: [/(?:www\.)?reddit\.com\/(r|user)\/[\w:.]{2,21}\/comments\/\w{5,9}/],

    extract(url: string): EmbedInfo | null {
        const match = url.match(
            /(?:www\.)?reddit\.com\/(r|user)\/([\w:.]{2,21})\/comments\/(\w{5,9})(?:\/([\w%\-]+))?/
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
        const slug = info.params?.slug ? `/${info.params.slug}` : '';
        const embedUrl = `https://www.redditmedia.com/${info.params?.type}/${info.params?.subreddit}/comments/${info.id}${slug}/?ref_source=embed&embed=true&theme=dark`;

        return `<iframe
			src="${embedUrl}"
			title="Reddit post"
			frameborder="0"
			scrolling="yes"
			sandbox="allow-scripts allow-same-origin allow-popups"
			style="width: 100%; min-height: 400px; max-height: 600px; border-radius: 8px;"
		></iframe>`;
    }
};
