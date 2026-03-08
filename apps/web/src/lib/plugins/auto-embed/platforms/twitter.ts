import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Twitter/X 임베딩 플랫폼
 */
export const twitter: EmbedPlatform = {
    name: 'twitter',
    patterns: [
        // twitter.com/USER/status/TWEET_ID
        /(?:www\.)?twitter\.com\/\w+\/status\/(\d+)/,
        // x.com/USER/status/TWEET_ID
        /(?:www\.)?x\.com\/\w+\/status\/(\d+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const tweetId = match[1];

                // 사용자 이름 추출
                const userMatch = url.match(/(?:twitter|x)\.com\/(\w+)\/status/);
                const username = userMatch ? userMatch[1] : '';

                return {
                    platform: 'twitter',
                    id: tweetId,
                    url,
                    // Twitter 임베드는 높이가 가변적이므로 aspectRatio 미사용
                    params: username ? { username } : undefined
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        const embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${info.id}&theme=light`;

        return `<iframe
			class="twitter-embed-iframe"
			src="${embedUrl}"
			title="Twitter post"
			data-tweet-id="${info.id}"
			frameborder="0"
			scrolling="no"
			allowtransparency="true"
			allowfullscreen
			style="width: 100%; min-height: 250px; border: none;"
		></iframe>`;
    }
};
