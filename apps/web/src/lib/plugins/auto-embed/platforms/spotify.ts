import type { EmbedInfo, EmbedPlatform } from '../types.js';

/**
 * 스포티파이 임베딩 플랫폼
 * open.spotify.com/track, album, playlist, episode, show
 */
export const spotify: EmbedPlatform = {
    name: 'spotify',
    patterns: [
        // open.spotify.com/track/ID, album/ID, playlist/ID, episode/ID, show/ID
        /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const type = match[1];
                const id = match[2];
                // 트랙/에피소드는 compact (152px), 앨범/플레이리스트/쇼는 넓음 (352px)
                const isCompact = type === 'track' || type === 'episode';
                return {
                    platform: 'spotify',
                    id,
                    url,
                    params: { type },
                    maxWidth: 600,
                    aspectRatio: isCompact ? undefined : undefined
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        const type = info.params?.type || 'track';
        const isCompact = type === 'track' || type === 'episode';
        const height = isCompact ? '152' : '352';

        return `<iframe
			src="https://open.spotify.com/embed/${type}/${info.id}?utm_source=generator&theme=0"
			title="Spotify"
			width="100%"
			height="${height}"
			frameborder="0"
			allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
			loading="lazy"
			style="border-radius: 12px; max-width: 100%;"
		></iframe>`;
    }
};
