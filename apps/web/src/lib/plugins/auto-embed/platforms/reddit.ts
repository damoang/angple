import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Reddit 임베딩 플랫폼 (iframe 방식)
 */
export const reddit: EmbedPlatform = {
    name: 'reddit',
    patterns: [
        /(?:www\.)?reddit\.com\/(r|user)\/[\w:.]{2,21}\/comments\/\w{5,9}/,
        /(?:www\.)?reddit\.com\/(r|user)\/[\w:.]{2,21}\/s\/[\w-]+/
    ],

    extract(url: string): EmbedInfo | null {
        // 표준 comments 링크
        const commentsMatch = url.match(
            /(?:www\.)?reddit\.com\/(r|user)\/([\w:.]{2,21})\/comments\/(\w{5,9})(?:\/([\w%\-]+))?/
        );
        if (commentsMatch) {
            return {
                platform: 'reddit',
                id: commentsMatch[3],
                url,
                params: {
                    type: commentsMatch[1],
                    subreddit: commentsMatch[2],
                    slug: commentsMatch[4] || ''
                }
            };
        }
        // 앱 단축 링크 (/r/.../s/...) — redirect URL이라 임베드 불가, 링크로만 표시
        const shortMatch = url.match(
            /(?:www\.)?reddit\.com\/(r|user)\/([\w:.]{2,21})\/s\/([\w-]+)/
        );
        if (shortMatch) {
            return {
                platform: 'reddit',
                id: shortMatch[3],
                url,
                params: {
                    type: shortMatch[1],
                    subreddit: shortMatch[2],
                    slug: '',
                    isShortLink: 'true'
                }
            };
        }
        return null;
    },

    render(info: EmbedInfo): string {
        // 앱 단축링크는 redirect URL이라 iframe 임베드 불가 → 링크 카드로 표시
        if (info.params?.isShortLink) {
            return `<a href="${info.url}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${info.url}</a>`;
        }

        const slug = info.params?.slug ? `/${info.params.slug}` : '';
        // #12044: redditmedia.com 은 embed.reddit.com 으로 301 redirect 되며, 이 redirect 가
        // sandbox/CSP 환경에서 정상 처리되지 않아 임베드가 비어있는 채로 남는 문제 발생.
        // 처음부터 최종 도메인(embed.reddit.com)을 사용하도록 변경.
        const embedUrl = `https://embed.reddit.com/${info.params?.type}/${info.params?.subreddit}/comments/${info.id}${slug}/?ref_source=embed&embed=true&theme=dark`;

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
