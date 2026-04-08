/**
 * 날짜별 공감글 캐시 파일 로더 (서버 전용)
 *
 * cron이 생성하는 날짜별 추천글 JSON 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { DailyCalendar, DailyEmpathyData } from '$lib/api/types';
import { env } from '$env/dynamic/private';

const DAILY_CACHE_DIR =
    env.RECOMMENDED_DAILY_DIR || '/home/damoang/www/data/cache/empathy/daily';

/** 인메모리 캐시 */
const cache = new Map<string, { data: unknown; timestamp: number }>();
const TODAY_TTL_MS = 60_000; // 오늘 데이터: 60초
const PAST_TTL_MS = 3_600_000; // 과거 데이터: 1시간

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function getTodayKST(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** YYYY-MM-DD 형식 검증 */
export function isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/**
 * 달력 데이터 로드
 */
export async function loadDailyCalendar(): Promise<DailyCalendar | null> {
    const cacheKey = 'calendar';
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TODAY_TTL_MS) {
        return cached.data as DailyCalendar;
    }

    const filePath = `${DAILY_CACHE_DIR}/calendar.json`;
    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: DailyCalendar = JSON.parse(content);
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    } catch (err) {
        console.error('[daily-empathy-loader] calendar.json 읽기 실패:', err);
        return (cached?.data as DailyCalendar) ?? null;
    }
}

/**
 * 특정 날짜의 공감글 데이터 로드
 */
export async function loadDailyEmpathy(date: string): Promise<DailyEmpathyData | null> {
    if (!isValidDate(date)) return null;

    const cached = cache.get(date);
    const isToday = date === getTodayKST();
    const ttl = isToday ? TODAY_TTL_MS : PAST_TTL_MS;

    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as DailyEmpathyData;
    }

    const filePath = `${DAILY_CACHE_DIR}/${date}.json`;
    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: DailyEmpathyData = JSON.parse(content);
        cache.set(date, { data, timestamp: Date.now() });
        return data;
    } catch (err) {
        console.error(`[daily-empathy-loader] ${date}.json 읽기 실패:`, err);
        return (cached?.data as DailyEmpathyData) ?? null;
    }
}
