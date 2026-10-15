/**
 * 게임 순위 저장소 — 공용 표 3개(angple_game_runs · angple_game_best · angple_game_weekly).
 *
 * - 판은 검사 결과와 상관없이 runs 에 늘 남긴다(의심 판은 flagged 로 기록만).
 * - 통과한 판만 best·weekly 를 「더 좋을 때만」 갱신한다 — INSERT … ON DUPLICATE KEY UPDATE 한 문장이라
 *   여러 파드에서 같은 회원의 판이 동시에 끝나도 안전하다. runs 와 함께 한 트랜잭션.
 * - 정렬 방향(높을수록/낮을수록)은 등록부 값(코드 상수)으로만 정한다 — 사용자 값이 SQL 에 들어가지 않는다.
 * - 순위·내 순위는 탈퇴·이용 제한 회원을 뺀다(뱀 게임 점수판과 같은 조건).
 * - 표가 아직 없으면(ER_NO_SUCH_TABLE) TablesMissingError 를 던진다 — API 는 「준비 중」으로 답한다.
 */
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool, readPool } from '$lib/server/db';
import { fetchMemberCards } from '$lib/server/member-card';
import { wallToRfc3339 } from './kst';

/** 순위표 줄 수 */
export const BOARD_SIZE = 10;

export class TablesMissingError extends Error {
    constructor() {
        super('game ranking tables missing');
        this.name = 'TablesMissingError';
    }
}

export function isNoSuchTable(err: unknown): boolean {
    const e = err as { code?: string; errno?: number } | null;
    return e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146;
}

/** 저장할 판 하나 */
export interface RunRecord {
    gameId: string;
    variant: string;
    runId: string;
    mbId: string;
    seed: number;
    score: number;
    ticks: number;
    inputsJson: string;
    engineVer: number;
    elapsedMs: number;
    flagged: boolean;
    flagReason: string;
    /** KST 벽시계 */
    startedAt: string;
    finishedAt: string;
    /** KST 월요일 YYYY-MM-DD */
    weekStart: string;
}

/** 저장 뒤 내 기록 */
export interface Standing {
    /** 역대 최고(없으면 null) */
    best: number | null;
    /** 이번 주 최고(없으면 null) */
    weekBest: number | null;
    /** 이번 주 순위(기록 없으면 없음) */
    rankWeek?: number;
}

/** 순위표 한 줄 — 회원 아이디는 싣지 않는다(닉네임만 공개) */
export interface BoardRow {
    rank: number;
    nickname: string;
    score: number;
    /** 기록 시각 RFC3339(+09:00), 모르면 빈 문자열 */
    achievedAt: string;
}

const MEMBER_OK = "m.mb_leave_date = '' AND m.mb_intercept_date = ''";

/** best·weekly 갱신 SQL — 더 좋을 때만 점수·run_id·기록 시각을 바꾼다 */
export function upsertSql(
    table: 'angple_game_best' | 'angple_game_weekly',
    higherIsBetter: boolean
) {
    const better = higherIsBetter ? '>' : '<';
    const pick = higherIsBetter ? 'GREATEST' : 'LEAST';
    const keyCols =
        table === 'angple_game_weekly'
            ? 'game_id, variant, week_start, mb_id'
            : 'game_id, variant, mb_id';
    const keyMarks = table === 'angple_game_weekly' ? '?, ?, ?, ?' : '?, ?, ?';
    // MySQL 은 ON DUPLICATE KEY UPDATE 의 대입을 왼쪽부터 하므로 score 는 맨 끝에 바꾼다.
    return (
        `INSERT INTO ${table} (${keyCols}, score, run_id, achieved_at) VALUES (${keyMarks}, ?, ?, ?)` +
        ' ON DUPLICATE KEY UPDATE' +
        ` run_id = IF(VALUES(score) ${better} score, VALUES(run_id), run_id),` +
        ` achieved_at = IF(VALUES(score) ${better} score, VALUES(achieved_at), achieved_at),` +
        ` score = ${pick}(score, VALUES(score))`
    );
}

/** 순위표 SQL — week=true 면 그 주(weekly), 아니면 역대(best). 같은 점수는 먼저 세운 사람이 위 */
export function topSql(week: boolean, higherIsBetter: boolean): string {
    const table = week ? 'angple_game_weekly' : 'angple_game_best';
    const weekCond = week ? ' AND t.week_start = ?' : '';
    const dir = higherIsBetter ? 'DESC' : 'ASC';
    return (
        "SELECT t.mb_id, m.mb_nick, t.score, COALESCE(DATE_FORMAT(t.achieved_at, '%Y-%m-%d %H:%i:%s'), '') AS achieved_raw" +
        ` FROM ${table} t JOIN g5_member m ON m.mb_id = t.mb_id` +
        ` WHERE t.game_id = ? AND t.variant = ?${weekCond} AND ${MEMBER_OK}` +
        ` ORDER BY t.score ${dir}, t.achieved_at ASC LIMIT ${BOARD_SIZE}`
    );
}

/** 이번 주 나보다 앞선 사람 수 SQL */
export function aheadSql(higherIsBetter: boolean): string {
    const better = higherIsBetter ? '>' : '<';
    return (
        'SELECT COUNT(*) AS n FROM angple_game_weekly w JOIN g5_member m ON m.mb_id = w.mb_id' +
        ` WHERE w.game_id = ? AND w.variant = ? AND w.week_start = ? AND w.score ${better} ? AND ${MEMBER_OK}`
    );
}

/** 표 3개가 있는지 — 있으면 길게, 없으면 짧게 기억한다 */
const READY_TTL_MS = 10 * 60 * 1000;
const NOT_READY_TTL_MS = 60 * 1000;
let readyCache: { ready: boolean; at: number } | null = null;

/**
 * 표가 준비됐는가. 표가 없으면 false, DB 오류도 false(그 판은 로컬로 — 기록 미등록).
 */
export async function tablesReady(now = Date.now()): Promise<boolean> {
    const c = readyCache;
    if (c && now - c.at < (c.ready ? READY_TTL_MS : NOT_READY_TTL_MS)) return c.ready;
    try {
        await pool.query(
            'SELECT 1 FROM angple_game_runs, angple_game_best, angple_game_weekly LIMIT 0'
        );
        readyCache = { ready: true, at: now };
        return true;
    } catch (err) {
        if (isNoSuchTable(err)) {
            readyCache = { ready: false, at: now };
        } else {
            console.error('[game-ranking] tables check failed:', (err as Error)?.message);
        }
        return false;
    }
}

/** 테스트용 — 표 확인 기억을 지운다 */
export function resetReadyCache(): void {
    readyCache = null;
}

/** 저장 실패 원인이 표 없음이면 기억도 고친다 */
function toStoreError(err: unknown): unknown {
    if (isNoSuchTable(err)) {
        readyCache = { ready: false, at: Date.now() };
        return new TablesMissingError();
    }
    return err;
}

async function writeRun(
    conn: PoolConnection,
    rec: RunRecord,
    higherIsBetter: boolean
): Promise<void> {
    await conn.query<ResultSetHeader>(
        `INSERT INTO angple_game_runs
           (game_id, variant, run_id, mb_id, seed, score, ticks, inputs_json, engine_ver, elapsed_ms,
            flagged, flag_reason, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            rec.gameId,
            rec.variant,
            rec.runId,
            rec.mbId,
            rec.seed,
            rec.score,
            rec.ticks,
            rec.inputsJson,
            rec.engineVer,
            rec.elapsedMs,
            rec.flagged ? 1 : 0,
            rec.flagReason || null,
            rec.startedAt,
            rec.finishedAt
        ]
    );
    // 의심 판·0점 판은 기록만 — 순위표에는 넣지 않는다
    if (rec.flagged || rec.score <= 0) return;
    await conn.query(upsertSql('angple_game_best', higherIsBetter), [
        rec.gameId,
        rec.variant,
        rec.mbId,
        rec.score,
        rec.runId,
        rec.finishedAt
    ]);
    await conn.query(upsertSql('angple_game_weekly', higherIsBetter), [
        rec.gameId,
        rec.variant,
        rec.weekStart,
        rec.mbId,
        rec.score,
        rec.runId,
        rec.finishedAt
    ]);
}

/** 판을 남기고(통과면 best·weekly 갱신) 내 기록을 돌려준다 — 한 트랜잭션 */
export async function saveRun(rec: RunRecord, higherIsBetter: boolean): Promise<Standing> {
    let conn: PoolConnection | null = null;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            await writeRun(conn, rec, higherIsBetter);
            await conn.commit();
        } catch (err) {
            await conn.rollback().catch(() => undefined);
            throw err;
        }
        // 저장은 끝났다 — 내 기록 조회가 실패해도 저장 실패로 알리지 않는다
        return await standing(conn, rec, higherIsBetter).catch((err: unknown) => {
            console.error('[game-ranking] standing failed:', (err as Error)?.message);
            return { best: null, weekBest: null };
        });
    } catch (err) {
        throw toStoreError(err);
    } finally {
        conn?.release();
    }
}

interface BestRow extends RowDataPacket {
    best: number | string | null;
    week_best: number | string | null;
}

function toNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

async function standing(
    conn: PoolConnection,
    rec: RunRecord,
    higherIsBetter: boolean
): Promise<Standing> {
    const [rows] = await conn.query<BestRow[]>(
        `SELECT (SELECT score FROM angple_game_best WHERE game_id = ? AND variant = ? AND mb_id = ?) AS best,
                (SELECT score FROM angple_game_weekly
                  WHERE game_id = ? AND variant = ? AND week_start = ? AND mb_id = ?) AS week_best`,
        [rec.gameId, rec.variant, rec.mbId, rec.gameId, rec.variant, rec.weekStart, rec.mbId]
    );
    const out: Standing = { best: toNum(rows[0]?.best), weekBest: toNum(rows[0]?.week_best) };
    if (out.weekBest === null) return out;
    const [ahead] = await conn.query<RowDataPacket[]>(aheadSql(higherIsBetter), [
        rec.gameId,
        rec.variant,
        rec.weekStart,
        out.weekBest
    ]);
    out.rankWeek = (Number(ahead[0]?.n) || 0) + 1;
    return out;
}

interface TopRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string | null;
    score: number | string;
    achieved_raw: string;
}

/** 순위표 상위 BOARD_SIZE 줄 — week 가 있으면 그 주, 없으면 역대 */
export async function topRows(
    gameId: string,
    variant: string,
    week: string | null,
    higherIsBetter: boolean
): Promise<BoardRow[]> {
    let rows: TopRow[];
    try {
        const args = week ? [gameId, variant, week] : [gameId, variant];
        [rows] = await readPool.query<TopRow[]>(topSql(!!week, higherIsBetter), args);
    } catch (err) {
        throw toStoreError(err);
    }
    // 닉네임은 회원 카드(공유 캐시)에서 — 못 읽으면 조인한 닉네임
    let cards: Awaited<ReturnType<typeof fetchMemberCards>> = new Map();
    try {
        cards = await fetchMemberCards(rows.map((r) => r.mb_id));
    } catch {
        // 카드 조회 실패 — 조인한 값 사용
    }
    const out: BoardRow[] = [];
    for (const r of rows) {
        const card = cards.get(r.mb_id);
        if (card?.isLeft) continue;
        out.push({
            rank: out.length + 1,
            nickname: card?.nick || r.mb_nick || '',
            score: Number(r.score) || 0,
            achievedAt: wallToRfc3339(r.achieved_raw)
        });
    }
    return out;
}
