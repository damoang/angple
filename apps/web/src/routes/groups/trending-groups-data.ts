/**
 * "지금 뜨는 소모임" 발견 위젯 데이터 모듈
 *
 * 소모임(g5_board.gr_id='group') 중 최근 활동이 활발한 상위 N개를 집계한다.
 * groups/+page.server.ts 의 집계와 동일 소스(g5_board + g5_board_new)를 재사용하되,
 * 무거운 subscriber(g5_board_subscribe) 조인은 제외해 read 경로 부하를 최소화한다.
 *
 * 순수 랭킹 로직은 trending-groups-rank.ts 로 분리(vitest 단독 검증).
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';
import { fetchPostDetails } from './groups-data.js';
import {
    rankTrendingGroups,
    clampLimit,
    MAX_LIMIT,
    type TrendingGroupRow
} from './trending-groups-rank.js';

export { clampLimit } from './trending-groups-rank.js';

export interface TrendingGroup {
    bo_table: string;
    /** 소문자 정규화 링크 경로 (라우트에서 canonical redirect 처리) */
    board_path: string;
    bo_subject: string;
    weekly_count: number;
    today_count: number;
    /** 최신 루트글 (없으면 null → 위젯에서 제목 줄 생략) */
    latest_wr_id: number | null;
    latest_subject: string | null;
}

/** 위젯 캐시: L1 60초, L2(Redis) 120초 */
const trendingCache = new TieredCache<TrendingGroup[]>('group-trending', 60_000, 120, 1);

/**
 * 활동순 상위 N개 소모임을 최신글 제목과 함께 반환한다.
 * 실패/빈 결과는 [] 로 graceful — 위젯은 활동 0이면 렌더하지 않는다.
 */
export async function loadTrendingGroups(limit = MAX_LIMIT): Promise<TrendingGroup[]> {
    const n = clampLimit(limit);
    const cacheKey = `top:${n}`;
    const cached = await trendingCache.get(cacheKey);
    if (cached) return cached;

    // 1) 소모임별 주간/오늘 글수 집계 (subscriber 조인 제외 — 경량).
    //    groups 페이지와 동일한 인덱스 시크 경로(bn_datetime range + bo_table group by).
    const [aggRows] = await readPool.query<RowDataPacket[]>(
        `SELECT b.bo_table, b.bo_subject,
                IFNULL(w.cnt, 0) AS weekly_count,
                IFNULL(t.cnt, 0) AS today_count
         FROM g5_board b
         LEFT JOIN (
             SELECT bo_table, COUNT(*) AS cnt
             FROM g5_board_new
             WHERE bn_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY bo_table
         ) w ON w.bo_table = b.bo_table
         LEFT JOIN (
             SELECT bo_table, COUNT(*) AS cnt
             FROM g5_board_new
             WHERE bn_datetime >= CURDATE()
             GROUP BY bo_table
         ) t ON t.bo_table = b.bo_table
         WHERE b.gr_id = 'group'`
    );

    const ranked = rankTrendingGroups(
        (aggRows as RowDataPacket[]).map<TrendingGroupRow>((r) => ({
            bo_table: r.bo_table as string,
            bo_subject: r.bo_subject as string,
            weekly_count: Number(r.weekly_count) || 0,
            today_count: Number(r.today_count) || 0
        })),
        n
    );

    if (ranked.length === 0) {
        await trendingCache.set(cacheKey, []);
        return [];
    }

    // 2) 상위 N 소모임의 최신 루트글 1건씩 조회 (제목 표시용).
    //    g5_board_new 는 board_new 인덱스로 bo_table IN + wr_parent=wr_id 시크.
    const topTables = ranked.map((r) => r.bo_table);
    const latestByTable = new Map<string, { wr_id: number; bn_datetime: string }>();
    try {
        const [refRows] = await readPool.query<RowDataPacket[]>(
            `SELECT n.bo_table, n.wr_id, n.bn_datetime
             FROM g5_board_new n
             JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
             WHERE n.bo_table IN (?) AND n.wr_parent = n.wr_id
             ORDER BY n.bn_datetime DESC`,
            [topTables]
        );
        for (const row of refRows as RowDataPacket[]) {
            const table = row.bo_table as string;
            // ORDER BY 최신순 → 각 게시판의 첫 등장이 최신글.
            if (!latestByTable.has(table)) {
                latestByTable.set(table, {
                    wr_id: row.wr_id as number,
                    bn_datetime: row.bn_datetime as string
                });
            }
        }
    } catch (err) {
        console.error('[groups/trending] latest ref 조회 에러:', err);
    }

    // 최신글 제목 조회 (동적 g5_write_ 테이블 + 이용제한 마스킹 재사용).
    const refs = ranked
        .map((r) => {
            const latest = latestByTable.get(r.bo_table);
            if (!latest) return null;
            return {
                bo_table: r.bo_table,
                bo_subject: r.bo_subject,
                wr_id: latest.wr_id,
                mb_id: '',
                bn_datetime: latest.bn_datetime
            };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    const details = await fetchPostDetails(refs);
    const subjectByTable = new Map<string, { wr_id: number; wr_subject: string }>();
    for (const d of details) {
        subjectByTable.set(d.bo_table, { wr_id: d.wr_id, wr_subject: d.wr_subject });
    }

    const result: TrendingGroup[] = ranked.map((r) => {
        const latest = subjectByTable.get(r.bo_table);
        return {
            bo_table: r.bo_table,
            board_path: r.bo_table.toLowerCase(),
            bo_subject: r.bo_subject,
            weekly_count: r.weekly_count,
            today_count: r.today_count,
            latest_wr_id: latest?.wr_id ?? null,
            latest_subject: latest?.wr_subject ?? null
        };
    });

    await trendingCache.set(cacheKey, result);
    return result;
}
