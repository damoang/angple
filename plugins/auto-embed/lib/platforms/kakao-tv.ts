import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Kakao TV 임베딩 플랫폼
 */
export const kakaoTv: EmbedPlatform = {
    name: 'kakao-tv',
    patterns: [
        /tv\.kakao\.com\/(v|l)\/([A-Za-z0-9]+)/,
        /tv\.kakao\.com\/channel\/\d+\/(livelink|cliplink)\/([A-Za-z0-9]+)/
    ],

    extract(url: string): EmbedInfo | null {
        // 채널 URL: tv.kakao.com/channel/123/cliplink/456
        const channelMatch = url.match(
            /tv\.kakao\.com\/channel\/\d+\/(livelink|cliplink)\/([A-Za-z0-9]+)/
        );
        if (channelMatch) {
            return {
                platform: 'kakao-tv',
                id: channelMatch[2],
                url,
                aspectRatio: 56.25,
                params: { type: channelMatch[1] }
            };
        }

        // 단축 URL: tv.kakao.com/v/VIDEO_ID 또는 tv.kakao.com/l/LIVE_ID
        const shortMatch = url.match(/tv\.kakao\.com\/(v|l)\/([A-Za-z0-9]+)/);
        if (shortMatch) {
            const type = shortMatch[1] === 'v' ? 'cliplink' : 'livelink';
            return {
                platform: 'kakao-tv',
                id: shortMatch[2],
                url,
                aspectRatio: 56.25,
                params: { type }
            };
        }

        return null;
    },

    render(info: EmbedInfo): string {
        const type = info.params?.type || 'cliplink';
        const embedUrl = `https://tv.kakao.com/embed/player/${type}/${info.id}?width=640&height=360&service=kakao_tv`;

        return `<iframe src="${embedUrl}" title="Kakao TV player" frameborder="0" scrolling="no" allowfullscreen></iframe>`;
    }
};
