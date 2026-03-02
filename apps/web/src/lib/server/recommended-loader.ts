/**
 * 추천글 캐시 파일 로더 (서버 전용)
 *
 * PHP 크론이 생성하는 추천글 JSON 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import type { RecommendedDataWithAI, RecommendedPeriod } from '$lib/api/types';
import { env } from '$env/dynamic/private';

const RECOMMENDED_CACHE_DIR =
    env.RECOMMENDED_CACHE_DIR || '/home/damoang/www/data/cache/recommended';

const PERIOD_FILES: Record<string, { base: string; ai: string }> = {
    '1h': { base: '1hour.json', ai: 'ai_1hour.json' },
    '3h': { base: '3hours.json', ai: 'ai_3hours.json' },
    '6h': { base: '6hours.json', ai: 'ai_6hours.json' },
    '12h': { base: '12hours.json', ai: 'ai_12hours.json' },
    '24h': { base: '24hours.json', ai: 'ai_24hours.json' },
    '48h': { base: '48hours.json', ai: 'ai_48hours.json' }
};

/** 인메모리 캐시 (period별) */
const cache = new Map<string, { data: RecommendedDataWithAI; timestamp: number }>();
const CACHE_TTL_MS = 30_000; // 30초

/**
 * 시간대별 기본 탭 결정 (PHP 원본 로직)
 * KST(한국 표준시) 기준으로 계산
 */
export function getDefaultPeriod(): RecommendedPeriod {
    // KST 시간대 명시적 사용 (서버가 UTC로 실행될 수 있음)
    const kstHour = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        hour12: false
    });
    const hour = parseInt(kstHour, 10);

    if (hour >= 0 && hour < 6) return '6h';
    if (hour >= 6 && hour < 9) return '3h';
    return '1h';
}

/**
 * 추천글 캐시 파일을 읽어 반환
 */
export async function loadRecommendedData(
    period: RecommendedPeriod
): Promise<RecommendedDataWithAI | null> {
    // 인메모리 캐시 확인
    const cached = cache.get(period);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    const files = PERIOD_FILES[period];
    if (!files) return null;

    const basePath = `${RECOMMENDED_CACHE_DIR}/${files.base}`;
    const aiPath = `${RECOMMENDED_CACHE_DIR}/${files.ai}`;

    let filePath = basePath;
    if (existsSync(aiPath) && existsSync(basePath)) {
        if (statSync(aiPath).mtimeMs >= statSync(basePath).mtimeMs) {
            filePath = aiPath;
        }
    } else if (existsSync(aiPath)) {
        filePath = aiPath;
    }

    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: RecommendedDataWithAI = JSON.parse(content);

        cache.set(period, { data, timestamp: Date.now() });
        return data;
    } catch (err) {
        console.error('[recommended-loader] 캐시 파일 읽기 실패:', err);
        // stale 캐시라도 반환
        return cached?.data ?? null;
    }
}
