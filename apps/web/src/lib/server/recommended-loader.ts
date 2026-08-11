/**
 * 추천글 캐시 파일 로더 (서버 전용)
 *
 * PHP 크론이 생성하는 추천글 JSON 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { rewriteImageHosts } from '$lib/server/cdn-rewrite';
import { existsSync, statSync } from 'node:fs';
import type { RecommendedDataWithAI, RecommendedPeriod, RecommendedSection } from '$lib/api/types';
import { findDisciplinedIds } from '$lib/server/discipline-mask';
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
const CACHE_TTL_MS = 60_000; // 60초 (PHP cron 주기적 업데이트)

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
 * 추천글 목록에서 **이용제한 근거 글**(g5_na_singo.discipline_log_id)을 제거한다.
 *
 * 메인 페이지 추천글도 날짜별 공감글과 동일하게 cron 스냅샷을 읽어 서빙하므로,
 * 스냅샷 생성 후 신고→징계된 글이 원제목으로 그대로 노출된다(콘텐츠 재노출 사고).
 * 추천 피드이므로 마스킹(제목 치환)보다 **목록에서 제외**가 맞다. 원본 캐시는
 * 건드리지 않고 사본을 반환한다.
 *
 * ⛔ 읽기 시점에 매번 판정한다(스냅샷 생성 후 징계돼도 즉시 반영). 판정 실패 시엔
 *    로깅만 하고 원본을 통과시킨다 — 판정이 드물게 실패해도 추천글이 통째로 비지
 *    않도록(fail-open, daily-recommended-loader 와 동일 정책).
 */
async function filterDisciplinedRecommended(
    data: RecommendedDataWithAI
): Promise<RecommendedDataWithAI> {
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
    const filterSection = (sec: RecommendedSection): RecommendedSection => {
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

/**
 * 추천글 캐시 파일을 읽어 반환 (이용제한 글 제외)
 */
export async function loadRecommendedData(
    period: RecommendedPeriod
): Promise<RecommendedDataWithAI | null> {
    const raw = await loadRecommendedDataRaw(period);
    if (!raw) return null;

    try {
        return await filterDisciplinedRecommended(raw);
    } catch (err) {
        console.error('[recommended-loader] 징계 필터 실패:', err);
        return raw;
    }
}

async function loadRecommendedDataRaw(
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
        const data: RecommendedDataWithAI = JSON.parse(rewriteImageHosts(content));

        cache.set(period, { data, timestamp: Date.now() });
        return data;
    } catch (err) {
        console.error('[recommended-loader] 캐시 파일 읽기 실패:', err);
        // stale 캐시라도 반환
        return cached?.data ?? null;
    }
}
