/**
 * 모아보기(Explore) 캐시 파일 로더 (서버 전용)
 *
 * Go generator가 5분마다 생성하는 explore.json 파일을 읽어 반환.
 * SSR (+page.server.ts) 및 API 엔드포인트에서 공용 사용.
 */

import { readFile } from 'node:fs/promises';
import { rewriteImageHosts } from '$lib/server/cdn-rewrite';
import { existsSync } from 'node:fs';
import type { ExploreData, ExploreModeData, ExplorePost, ExploreComment } from '$lib/api/types';
import { findDisciplinedIds } from '$lib/server/discipline-mask';
import { env } from '$env/dynamic/private';

const CACHE_DIR = env.RECOMMENDED_CACHE_DIR || '/home/damoang/www/data/cache/recommended';
const EXPLORE_FILE = 'explore.json';

/** 인메모리 캐시 */
let cache: { data: ExploreData; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60초

const PREVIEW_POST_COUNT = 17;

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
 * 모아보기 목록에서 **이용제한 근거 글**(g5_na_singo.discipline_log_id)을 제거한다.
 *
 * 추천글·공감글과 동일하게 explore.json 은 cron 스냅샷이라, 생성 후 신고→징계된 글이
 * 원제목(댓글은 parent_title)으로 그대로 노출된다. 마스킹 대신 목록에서 제외한다.
 * mode(hot/new/rising/top) × {posts, periods.24h/7d/30d, comments, comment_periods.*}
 * 를 모두 훑어 글(id)과 댓글의 부모글(parent_id)까지 판정 대상으로 삼는다.
 *
 * ⛔ 읽기 시점 매번 판정(스냅샷 생성 후 징계 즉시 반영). 판정 실패 시 로깅만 하고
 *    원본 통과(fail-open, 다른 마스킹 표면과 동일).
 */
async function filterDisciplinedExplore(data: ExploreData): Promise<ExploreData> {
    const modes = data.modes;
    if (!modes) return data;
    const modeList = [modes.hot, modes.new, modes.rising, modes.top].filter(Boolean);

    // 1) board별 판정 대상 id 수집 (글 id + 댓글 자신 id + 댓글 부모 parent_id)
    const byBoard = new Map<string, Set<number>>();
    const add = (board: string | undefined, id: number | undefined) => {
        if (!board || !id) return;
        let set = byBoard.get(board);
        if (!set) byBoard.set(board, (set = new Set()));
        set.add(id);
    };
    const eachPost = (arr: ExplorePost[] | undefined) => arr?.forEach((p) => add(p.board, p.id));
    const eachComment = (arr: ExploreComment[] | undefined) =>
        arr?.forEach((c) => {
            add(c.board, c.id);
            add(c.board, c.parent_id);
        });
    for (const m of modeList) {
        eachPost(m.posts);
        eachPost(m.periods?.['24h']);
        eachPost(m.periods?.['7d']);
        eachPost(m.periods?.['30d']);
        eachComment(m.comments);
        eachComment(m.comment_periods?.['24h']);
        eachComment(m.comment_periods?.['7d']);
        eachComment(m.comment_periods?.['30d']);
    }
    if (byBoard.size === 0) return data;

    const disciplined = new Map<string, Set<number>>();
    await Promise.all(
        [...byBoard].map(async ([board, ids]) => {
            disciplined.set(board, await findDisciplinedIds(board, [...ids]));
        })
    );
    const isDisc = (board: string, id: number) => disciplined.get(board)?.has(id) === true;

    // 2) 사본을 만들며 제외
    const keepPosts = (arr: ExplorePost[] | undefined): ExplorePost[] | undefined =>
        arr?.filter((p) => !isDisc(p.board, p.id));
    const keepComments = (arr: ExploreComment[] | undefined): ExploreComment[] | undefined =>
        arr?.filter((c) => !isDisc(c.board, c.id) && !isDisc(c.board, c.parent_id));
    const filterMode = (m: ExploreModeData): ExploreModeData => ({
        ...m,
        posts: keepPosts(m.posts) ?? m.posts,
        periods: m.periods
            ? {
                  '24h': keepPosts(m.periods['24h']) ?? [],
                  '7d': keepPosts(m.periods['7d']) ?? [],
                  '30d': keepPosts(m.periods['30d']) ?? []
              }
            : m.periods,
        comments: keepComments(m.comments) ?? m.comments,
        comment_periods: m.comment_periods
            ? {
                  '24h': keepComments(m.comment_periods['24h']) ?? [],
                  '7d': keepComments(m.comment_periods['7d']) ?? [],
                  '30d': keepComments(m.comment_periods['30d']) ?? []
              }
            : m.comment_periods
    });

    return {
        ...data,
        modes: {
            hot: filterMode(modes.hot),
            new: filterMode(modes.new),
            rising: filterMode(modes.rising),
            top: filterMode(modes.top)
        }
    };
}

/**
 * explore.json 캐시 파일을 읽어 반환 (이용제한 글 제외)
 */
export async function loadExploreData(): Promise<ExploreData | null> {
    const raw = await loadExploreDataRaw();
    if (!raw) return null;
    try {
        return await filterDisciplinedExplore(raw);
    } catch (err) {
        console.error('[explore-loader] 징계 필터 실패:', err);
        return raw;
    }
}

async function loadExploreDataRaw(): Promise<ExploreData | null> {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
        return cache.data;
    }

    const filePath = `${CACHE_DIR}/${EXPLORE_FILE}`;
    if (!existsSync(filePath)) return null;

    try {
        const content = await readFile(filePath, 'utf-8');
        const data: ExploreData = JSON.parse(rewriteImageHosts(content));
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
