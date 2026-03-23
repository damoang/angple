/**
 * 톺아보기(Explore) 캐시 파일 로더 (서버 전용)
 *
 * Go generator가 5분마다 생성하는 explore.json 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ExploreData, ExploreModeData } from '$lib/api/types';
import { env } from '$env/dynamic/private';

const CACHE_DIR = env.RECOMMENDED_CACHE_DIR || '/home/damoang/www/data/cache/recommended';
const EXPLORE_FILE = 'explore.json';

/** 인메모리 캐시 */
let cache: { data: ExploreData; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60초

const PREVIEW_POST_COUNT = 10;

function trimExploreModeData(mode: ExploreModeData, topOnly = false): ExploreModeData {
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
 * explore.json 캐시 파일을 읽어 반환
 */
export async function loadExploreData(): Promise<ExploreData | null> {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
        return cache.data;
    }

    const filePath = `${CACHE_DIR}/${EXPLORE_FILE}`;
    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: ExploreData = JSON.parse(content);
        cache = { data, timestamp: Date.now() };
        return data;
    } catch (err) {
        console.error('[explore-loader] 캐시 파일 읽기 실패:', err);
        return cache?.data ?? null;
    }
}

export function buildExplorePreviewData(data: ExploreData): ExploreData {
    return {
        ...data,
        total_comments: 0,
        board_count: 0,
        modes: {
            hot: trimExploreModeData(data.modes.hot),
            new: trimExploreModeData(data.modes.new),
            rising: trimExploreModeData(data.modes.rising),
            top: trimExploreModeData(data.modes.top, true)
        }
    };
}
