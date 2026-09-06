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

/**
 * 서버가 미리보기로 내려주는 모드별 글 수.
 *
 * ⛔ 클라이언트가 화면에 그리는 개수는 17개다(explore-preview.svelte `PREVIEW_COUNT`).
 *    이 상수는 **그 17개를 채우기 위한 후보 공급량**이지 표시 개수가 아니다.
 *
 * 왜 17 이면 안 됐나 — 클라이언트는 slice(0,17) **앞에서** 차단 회원·차단 키워드·
 * 공감글 중복(#13598)을 걸러낸다. 「빠진 만큼 다른 글로 채운다」는 의도였지만
 * 서버가 딱 17개만 줘서 채울 여분이 0 이었다. 새벽에는 새 글이 적어 공감글과
 * 후보가 크게 겹쳐 실제로 **8개**까지 줄었다(공감글 23개 중 9개가 앞 17개와 중복).
 *
 * 왜 42 인가 — 17(표시) + 25(제외 상한). 공감글 id 집합은 홈 SSR prefetch 의
 * 기본 기간(getDefaultPeriod: 0~6시 6h / 6~9시 3h / 그 외 1h)에서 만들어지고,
 * 그 상한이 6h 스냅샷의 25개다(community 15 + group 7 + info 3). 즉 공감글 중복만으로는
 * 42개 후보가 17개 아래로 깎이지 않는다. 실측 캐시로 「17개를 채우는 데 필요한 깊이」를
 * 12개 조합(4모드 × 3기간)에서 재보니 최댓값이 32였고, 42는 그 위로 10개 여유다.
 *
 * ⛔ 공짜가 아니다. 이 응답은 홈에서 매번 부르고 s-maxage=120 으로 캐시된다.
 *    실측(운영 응답 구조 동일): 17 → 23,504B / gzip 4,504B, 42 → 57,756B / gzip 9,865B.
 *    즉 gzip +5,361B(+119%). 더 올릴 거면 이 숫자부터 다시 재라.
 * ⛔ 50 을 넘기지 마라. 원본이 rising 50개 / top periods['24h'] 50개뿐이라 그 위는
 *    바이트만 늘고 후보는 안 는다(hot/new 만 100개).
 * ⛔ top 모드는 posts 가 아니라 periods['24h'] 를 쓴다 — 아래 slice 두 곳 모두에 걸린다.
 */
const PREVIEW_POST_COUNT = 42;
// ⛔ 2026-09-07 추가 — 비용은 API 만이 아니다.
//    이 페이로드는 **홈 SSR HTML 에도 그대로 실린다**(`+page.server.ts` → HomePageData.exploreData).
//    실측: 홈 HTML 461,836B / gzip 69,505B 기준 **+34.3KB raw(+7.4%) · +5.6KB gzip(+8%)**.
//    API 응답 자체는 gzip 4,186 → 9,812B (+134%).

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
