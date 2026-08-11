/**
 * 날짜별 공감글 캐시 파일 로더 (서버 전용)
 *
 * cron이 생성하는 날짜별 추천글 JSON 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { rewriteImageHosts } from '$lib/server/cdn-rewrite';
import { existsSync } from 'node:fs';
import type { DailyCalendar, DailyRecommendedData, DailyRecommendedSection } from '$lib/api/types';
import { findDisciplinedIds } from '$lib/server/discipline-mask';
import { env } from '$env/dynamic/private';

const DAILY_CACHE_DIR =
    env.RECOMMENDED_DAILY_DIR || '/home/damoang/www/data/cache/recommended/daily';

/** 인메모리 캐시 */
const cache = new Map<string, { data: unknown; timestamp: number }>();
const TODAY_TTL_MS = 60_000; // 오늘 데이터: 60초
const PAST_TTL_MS = 3_600_000; // 과거 데이터: 1시간
const CACHE_MAX = 200; // date 키 — 365일 이상 누적 시 cap (insertion order evict)

function setCacheBounded(key: string, data: unknown, timestamp: number): void {
    if (cache.size >= CACHE_MAX) {
        const targetSize = Math.floor(CACHE_MAX / 2);
        let toDrop = cache.size - targetSize;
        for (const k of cache.keys()) {
            if (toDrop-- <= 0) break;
            cache.delete(k);
        }
    }
    cache.set(key, { data, timestamp });
}

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
        const data: DailyCalendar = JSON.parse(rewriteImageHosts(content));
        setCacheBounded(cacheKey, data, Date.now());
        return data;
    } catch (err) {
        console.error('[daily-recommended-loader] calendar.json 읽기 실패:', err);
        return (cached?.data as DailyCalendar) ?? null;
    }
}

/**
 * 특정 날짜의 공감글 데이터 로드
 */
/**
 * 공감글 목록에서 **이용제한 근거 글**(g5_na_singo.discipline_log_id)을 제거한다.
 *
 * cron 이 만든 스냅샷에는 이후 신고→징계된 글이 그대로 남아, scrap/신고목록처럼
 * 마스킹하지 않으면 공감글에 원제목으로 노출된다(콘텐츠 재노출 사고). 추천 피드이므로
 * 마스킹(제목 치환)보다 **목록에서 제외**가 맞다. 원본 캐시는 건드리지 않고 사본을 반환한다.
 *
 * ⛔ 읽기 시점에 매번 판정한다(스냅샷 생성 후 징계돼도 즉시 반영). 실패 시엔 원본을
 *    그대로 반환하기보다 로깅만 하고 통과시킨다 — 판정 자체가 드물게 실패해도 공감글이
 *    통째로 비지 않도록. (근거 글은 이미 신고 처리 대상이라 잔여 노출 위험은 제한적)
 */
async function filterDisciplinedRecommended(
    data: DailyRecommendedData
): Promise<DailyRecommendedData> {
    const sections = data.sections;
    if (!sections) return data;

    const byBoard = new Map<string, Set<number>>();
    for (const key of ['community', 'group', 'info'] as const) {
        for (const p of sections[key]?.posts ?? []) {
            if (!p.board || !p.id) continue;
            let set = byBoard.get(p.board);
            if (!set) byBoard.set(p.board, (set = new Set()));
            set.add(p.id);
        }
    }
    if (byBoard.size === 0) return data;

    const disciplined = new Map<string, Set<number>>();
    await Promise.all(
        [...byBoard].map(async ([board, ids]) => {
            disciplined.set(board, await findDisciplinedIds(board, [...ids]));
        })
    );

    const isDisc = (board: string, id: number) => disciplined.get(board)?.has(id) === true;
    const filterSection = (sec: DailyRecommendedSection): DailyRecommendedSection => {
        if (!sec?.posts) return sec;
        const kept = sec.posts.filter((p) => !isDisc(p.board, p.id));
        return kept.length === sec.posts.length ? sec : { ...sec, posts: kept, count: kept.length };
    };

    return {
        ...data,
        sections: {
            community: filterSection(sections.community),
            group: filterSection(sections.group),
            info: filterSection(sections.info)
        }
    };
}

export async function loadDailyRecommended(date: string): Promise<DailyRecommendedData | null> {
    if (!isValidDate(date)) return null;

    const raw = await loadDailyRecommendedRaw(date);
    if (!raw) return null;

    try {
        return await filterDisciplinedRecommended(raw);
    } catch (err) {
        console.error(`[daily-recommended-loader] ${date} 징계 필터 실패:`, err);
        return raw;
    }
}

async function loadDailyRecommendedRaw(date: string): Promise<DailyRecommendedData | null> {
    const cached = cache.get(date);
    const isToday = date === getTodayKST();
    const ttl = isToday ? TODAY_TTL_MS : PAST_TTL_MS;

    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data as DailyRecommendedData;
    }

    const filePath = `${DAILY_CACHE_DIR}/${date}.json`;
    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: DailyRecommendedData = JSON.parse(rewriteImageHosts(content));
        cache.set(date, { data, timestamp: Date.now() });
        return data;
    } catch (err) {
        console.error(`[daily-recommended-loader] ${date}.json 읽기 실패:`, err);
        return (cached?.data as DailyRecommendedData) ?? null;
    }
}
