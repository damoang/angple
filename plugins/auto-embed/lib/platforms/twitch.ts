import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * Twitch 임베딩 플랫폼
 * 지원: 클립, VOD, 채널 라이브
 */
export const twitch: EmbedPlatform = {
    name: 'twitch',
    patterns: [
        /(?:www\.)?twitch\.tv\/\w+\/clip\/([a-zA-Z0-9_-]+)/,
        /clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/,
        /(?:www\.)?twitch\.tv\/videos\/(\d+)/,
        /(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)$/
    ],

    extract(url: string): EmbedInfo | null {
        const clipMatch =
            url.match(/twitch\.tv\/\w+\/clip\/([a-zA-Z0-9_-]+)/) ||
            url.match(/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/);
        if (clipMatch) {
            return {
                platform: 'twitch-clip',
                id: clipMatch[1],
                url,
                aspectRatio: 56.25,
                params: { type: 'clip' }
            };
        }

        const videoMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
        if (videoMatch) {
            return {
                platform: 'twitch-video',
                id: videoMatch[1],
                url,
                aspectRatio: 56.25,
                params: { type: 'video' }
            };
        }

        const channelMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)$/);
        if (channelMatch && !url.includes('/videos/') && !url.includes('/clip/')) {
            return {
                platform: 'twitch-channel',
                id: channelMatch[1],
                url,
                aspectRatio: 56.25,
                params: { type: 'channel' }
            };
        }

        return null;
    },

    render(info: EmbedInfo): string {
        const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        let embedUrl: string;

        switch (info.params?.type) {
            case 'clip':
                embedUrl = `https://clips.twitch.tv/embed?clip=${info.id}&parent=${parent}`;
                break;
            case 'video':
                embedUrl = `https://player.twitch.tv/?video=${info.id}&parent=${parent}`;
                break;
            case 'channel':
            default:
                embedUrl = `https://player.twitch.tv/?channel=${info.id}&parent=${parent}`;
                break;
        }

        return `<iframe src="${embedUrl}" title="Twitch embed" frameborder="0" allowfullscreen></iframe>`;
    }
};
