/**
 * 플랫폼 레지스트리
 * 지원하는 모든 임베딩 플랫폼을 등록
 */

import type { EmbedPlatform } from '../types.js';
import { youtube } from './youtube.js';
import { vimeo } from './vimeo.js';
import { instagram } from './instagram.js';
import { twitter } from './twitter.js';
import { twitch } from './twitch.js';
import { tiktok } from './tiktok.js';

/**
 * 등록된 플랫폼 목록 (순서대로 매칭)
 */
export const platforms: EmbedPlatform[] = [youtube, vimeo, instagram, twitter, twitch, tiktok];

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

export { youtube, vimeo, instagram, twitter, twitch, tiktok };
