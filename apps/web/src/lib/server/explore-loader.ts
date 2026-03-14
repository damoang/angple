/**
 * 톺아보기(Explore) 캐시 파일 로더 (서버 전용)
 *
 * Go generator가 5분마다 생성하는 explore.json 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ExploreData } from '$lib/api/types';
import { env } from '$env/dynamic/private';

const CACHE_DIR = env.RECOMMENDED_CACHE_DIR || '/home/damoang/www/data/cache/recommended';
const EXPLORE_FILE = 'explore.json';

/** 인메모리 캐시 */
let cache: { data: ExploreData; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60초

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
