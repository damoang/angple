/**
 * 플랫폼 레지스트리
 * 지원하는 모든 임베딩 플랫폼을 등록
 */

import type { EmbedPlatform } from '../types';
import { youtube } from './youtube';
import { vimeo } from './vimeo';
import { instagram } from './instagram';
import { twitter } from './twitter';
import { twitch } from './twitch';
import { tiktok } from './tiktok';
import { reddit } from './reddit';
import { bluesky } from './bluesky';
import { dailymotion } from './dailymotion';
import { kakaoTv } from './kakao-tv';

/**
 * 등록된 플랫폼 목록 (순서대로 매칭)
 */
export const platforms: EmbedPlatform[] = [
    youtube,
    vimeo,
    instagram,
    twitter,
    twitch,
    tiktok,
    reddit,
    bluesky,
    dailymotion,
    kakaoTv
];

/**
 * 플랫폼 이름으로 조회
 */
export function getPlatform(name: string): EmbedPlatform | undefined {
    return platforms.find((p) => p.name === name);
}

/**
 * URL에 매칭되는 플랫폼 찾기
 */
export function findPlatform(url: string): EmbedPlatform | undefined {
    for (const platform of platforms) {
        for (const pattern of platform.patterns) {
            if (pattern.test(url)) {
                return platform;
            }
        }
    }
    return undefined;
}

export {
    youtube,
    vimeo,
    instagram,
    twitter,
    twitch,
    tiktok,
    reddit,
    bluesky,
    dailymotion,
    kakaoTv
};
