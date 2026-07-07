/**
 * 이용제한 근거 글/댓글 마스킹 공용 헬퍼 (SSR 전용).
 *
 * 원천: `g5_na_singo.discipline_log_id IS NOT NULL` + sg_table(board) + sg_id(wr_id).
 * 운영자가 이용제한 근거로 지목한 글/댓글이며, 제목에 욕설·분란 유도가 많아 목록·검색·
 * 피드·RSS 등 서버 렌더 표면에서 제목을 치환한다(무조건 마스킹 → auth 무관 캐시 안전,
 * 비로그인 소스에도 원문 미포함 = 봇/작업세력 추출 차단). 상세 페이지의 로그인 토글 열람은
 * 백엔드(angple-backend)가 별도 처리하며, 이 헬퍼는 목록성 표면 전용이다.
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/** 이용제한 근거 글 제목 placeholder (백엔드 표기와 일치). */
export const DISCIPLINED_TITLE = '[이용제한 근거 글]';

interface SingoRow extends RowDataPacket {
    sg_id: number;
}

/**
 * 한 게시판(boardId=bo_table)에서 주어진 wr_id 중 이용제한 근거로 지목된 id 집합 반환.
 * 빈 입력이면 빈 Set. 실패해도 throw 하지 않고 빈 Set 반환(표면 렌더를 막지 않음).
 */
export async function findDisciplinedIds(boardId: string, wrIds: number[]): Promise<Set<number>> {
    const set = new Set<number>();
    if (!boardId || wrIds.length === 0) return set;
    const ph = wrIds.map(() => '?').join(',');
    try {
        const [rows] = await readPool.query<SingoRow[]>(
            `SELECT DISTINCT sg_id FROM g5_na_singo WHERE sg_table = ? AND sg_id IN (${ph}) AND discipline_log_id IS NOT NULL`,
            [boardId, ...wrIds]
        );
        for (const r of rows) set.add(r.sg_id);
    } catch {
        // 조회 실패 시 마스킹만 생략(표면은 정상 렌더). 원문 노출은 되지만 가용성 우선.
        return set;
    }
    return set;
}

/**
 * 여러 게시판에 걸친 (board, wr_id) 쌍을 board별로 묶어 한 번에 조회.
 * 반환: `${board}:${wr_id}` 키 Set (검색의 deletedSet 패턴과 동일).
 */
export async function findDisciplinedKeys(
    pairs: Array<{ board: string; wrId: number }>
): Promise<Set<string>> {
    const keys = new Set<string>();
    if (pairs.length === 0) return keys;
    const byBoard = new Map<string, number[]>();
    for (const { board, wrId } of pairs) {
        if (!board || !wrId) continue;
        const arr = byBoard.get(board);
        if (arr) arr.push(wrId);
        else byBoard.set(board, [wrId]);
    }
    await Promise.all(
        [...byBoard.entries()].map(async ([board, ids]) => {
            const set = await findDisciplinedIds(board, ids);
            for (const id of set) keys.add(`${board}:${id}`);
        })
    );
    return keys;
}
