import type { EmbedInfo, EmbedPlatform } from '../types';

/**
 * YouTube 임베딩 플랫폼
 * 지원: 일반 영상, Shorts, Live, 재생목록
 */
export const youtube: EmbedPlatform = {
    name: 'youtube',
    patterns: [
        /(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
        /(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ],

    extract(url: string): EmbedInfo | null {
        for (const pattern of this.patterns) {
            const match = url.match(pattern);
            if (match) {
                const videoId = match[1];
                const isShorts = url.includes('/shorts/');
                const params: Record<string, string> = {};

                const timeMatch = url.match(/[?&]t=(\d+)/);
                if (timeMatch) {
                    params.start = timeMatch[1];
                }

                const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
                if (listMatch) {
                    params.list = listMatch[1];
                }

                return {
                    platform: isShorts ? 'youtube-shorts' : 'youtube',
                    id: videoId,
                    url,
                    // youtube /embed/ 는 shorts 도 16:9 player 로 렌더하므로 항상 16:9.
                    // 9:16(177.78%) 컨테이너로 두면 위아래 거대한 빈 공간이 생긴다(bug/13417,
                    // 본문 사본은 #1496 에서 이미 고쳐졌는데 이 댓글 사본만 stale 이었다).
                    // 폭은 maxWidth(CSS) 로 제한한다 — 본문 사본과 동일.
                    aspectRatio: 56.25,
                    maxWidth: isShorts ? 400 : 560,
                    params: Object.keys(params).length > 0 ? params : undefined
                };
            }
        }
        return null;
    },

    render(info: EmbedInfo): string {
        let embedUrl = `https://www.youtube.com/embed/${info.id}`;

        const queryParams: string[] = [];
        if (info.params?.start) {
            queryParams.push(`start=${info.params.start}`);
        }
        if (info.params?.list) {
            queryParams.push(`list=${info.params.list}`);
        }
        if (queryParams.length > 0) {
            embedUrl += '?' + queryParams.join('&');
        }

        return `<iframe src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }
};
