/**
 * 모아보기(Discover) 캐시 파일 로더 (서버 전용)
 *
 * Go generator가 5분마다 생성하는 discover.json 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { DiscoverData, DiscoverModeData } from '$lib/api/types';
import { env } from '$env/dynamic/private';

const CACHE_DIR = env.RECOMMENDED_CACHE_DIR || '/home/damoang/www/data/cache/empathy';
const EXPLORE_FILE = 'discover.json';

/** 인메모리 캐시 */
let cache: { data: DiscoverData; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60초

const PREVIEW_POST_COUNT = 17;

function trimDiscoverModeData(mode: DiscoverModeData, topOnly = false): DiscoverModeData {
    return {
        ...mode,
        posts: topOnly ? [] : (mode.posts ?? []).slice(0, PREVIEW_POST_COUNT),
        periods: mode.periods
            ? {
                  '24h': mode.periods['24h']?.slice(0, PREVIEW_POST_COUNT) ?? [],
                  '7d': [],
                  '30d': []
              }
            : undefined,
        comments: [],
        comment_periods: undefined
    };
}

/**
 * discover.json 캐시 파일을 읽어 반환
 */
export async function loadDiscoverData(): Promise<DiscoverData | null> {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
        return cache.data;
    }

    const filePath = `${CACHE_DIR}/${EXPLORE_FILE}`;
    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: DiscoverData = JSON.parse(content);
        cache = { data, timestamp: Date.now() };
        return data;
    } catch (err) {
        console.error('[discover-loader] 캐시 파일 읽기 실패:', err);
        return cache?.data ?? null;
    }
}

export function buildDiscoverPreviewData(data: DiscoverData): DiscoverData {
    return {
        ...data,
        total_comments: 0,
        board_count: 0,
        modes: {
            hot: trimDiscoverModeData(data.modes.hot),
            new: trimDiscoverModeData(data.modes.new),
            rising: trimDiscoverModeData(data.modes.rising),
            top: trimDiscoverModeData(data.modes.top, true)
        }
    };
}
