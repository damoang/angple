/**
 * 글에 투표가 달려 있는지 (상세 SSR → 투표 위젯 힌트)
 *
 * 투표는 극소수 글에만 달리는데 위젯은 모든 글 상세에서 by-post 를 불렀다.
 * 로더가 이 값을 실어 보내고, false + 비작성자면 위젯이 호출을 생략한다.
 *
 * ⛔ 반환값은 3상태다. 조회 실패·잘못된 인자는 반드시 null(=모름) — false(=없음)로
 *    떨어뜨리면 투표가 있는 글에서도 위젯이 사라진다(fail-open 이 깨짐).
 * 비로그인 상세는 엣지 캐시(s-maxage=60, swr=120)라 이 값도 본문과 수명이 같다(최대 180초).
 *    생성만 늦게 보이고, 삭제 방향(true 잔존)은 위젯이 조회해 exists:false 를 받으므로 무해.
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

// 본문 SSR 을 막는 1단계 묶음에서 기다리는 값이라 짧게 끊는다. 늦으면 null(모름)로
// 두면 위젯이 기존처럼 호출하므로(fail-open) 풀 포화 때 본문을 늦출 이유가 없다.
export const HAS_POLL_TIMEOUT_MS = 300;

export async function fetchHasPoll(boTable: string, wrId: number): Promise<boolean | null> {
    if (!boTable || !Number.isInteger(wrId) || wrId <= 0) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        // uq_post(bo_table, wr_id) 유니크 인덱스 1건 조회
        const query = readPool
            .query<
                RowDataPacket[]
            >('SELECT 1 FROM angple_polls WHERE bo_table = ? AND wr_id = ? LIMIT 1', [boTable, wrId])
            .then(([rows]) => rows.length > 0);
        const timeout = new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), HAS_POLL_TIMEOUT_MS);
        });
        // 진 쪽 쿼리가 나중에 실패해도 unhandled rejection 이 되지 않게
        query.catch(() => {});
        return await Promise.race([query, timeout]);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
