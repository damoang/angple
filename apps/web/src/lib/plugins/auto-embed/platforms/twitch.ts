import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * Twitch 임베딩 플랫폼
 * 지원: 클립, VOD, 채널 라이브
 */
export const twitch: EmbedPlatform = {
	name: 'twitch',
	patterns: [
		// twitch.tv/CHANNEL/clip/CLIP_ID
		/(?:www\.)?twitch\.tv\/\w+\/clip\/([a-zA-Z0-9_-]+)/,
		// clips.twitch.tv/CLIP_ID
		/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/,
		// twitch.tv/videos/VIDEO_ID
		/(?:www\.)?twitch\.tv\/videos\/(\d+)/,
		// twitch.tv/CHANNEL (라이브)
		/(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)$/
	],

	extract(url: string): EmbedInfo | null {
		// 클립
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

		// VOD
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

		// 채널 라이브
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
		// 현재 도메인 (parent 필수)
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

		return `<iframe
			src="${embedUrl}"
			title="Twitch embed"
			frameborder="0"
			allowfullscreen
		></iframe>`;
	}
};
