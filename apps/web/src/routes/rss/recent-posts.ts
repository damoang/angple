import type { Pool, RowDataPacket } from 'mysql2/promise';

/**
 * RSS 최근 글 조회 (전체 피드·게시판별 피드 공용)
 *
 * ⭐ 안쪽에서 `wr_id` 역순으로 후보를 먼저 자른다. 인덱스 순서와 정렬이 같아
 *    읽다가 바로 멈추고, 실행 계획이 전체 정렬(filesort)로 바뀔 여지가 없다.
 *    바깥에서 후보 안을 `wr_datetime` 으로 다시 정렬하므로 결과는 그대로
 *    「날짜 최신순」이다.
 *
 * ⛔ 일부 이관 게시판은 글 번호가 날짜순이 아니다. 후보 수를 바깥 LIMIT 만큼으로
 *    줄이면 그런 게시판에서 결과가 달라진다. 넉넉하게 둔다.
 *
 * ⛔ 피드에 본문을 싣지 않으므로 `wr_content` 는 읽지 않는다.
 *    삭제 표시는 `wr_deleted_at IS NULL` 만 사용한다.
 */
export const RECENT_POST_CANDIDATES = 300;

export interface RecentPostRow {
    wr_id: number;
    wr_subject: string;
    wr_name: string;
    wr_datetime: string;
}

const TABLE_RE = /^[a-zA-Z0-9_]+$/;

/** 최근 글 SQL 을 만든다. 테이블명이 올바르지 않으면 던진다(SQL injection 방지). */
export function buildRecentPostsSql(boTable: string): string {
    if (!TABLE_RE.test(boTable)) {
        throw new Error(`invalid board table: ${boTable}`);
    }
    // ⛔ 안쪽 단계는 기본키 역순으로만 읽게 고정한다 — 게시판마다 다른 보조
    //    인덱스로 잡히면 전체 정렬이 된다.
    return `SELECT wr_id, wr_subject, wr_name, wr_datetime FROM (
                SELECT wr_id, wr_subject, wr_name, wr_datetime
                  FROM g5_write_${boTable} FORCE INDEX (PRIMARY)
                 WHERE wr_is_comment = 0 AND wr_deleted_at IS NULL
                 ORDER BY wr_id DESC
                 LIMIT ${RECENT_POST_CANDIDATES}
            ) recent
            ORDER BY wr_datetime DESC
            LIMIT ?`;
}

/** 게시판의 최근 글 `limit` 건 (날짜 최신순) */
export async function fetchRecentPosts(
    db: Pick<Pool, 'query'>,
    boTable: string,
    limit: number
): Promise<RecentPostRow[]> {
    const sql = buildRecentPostsSql(boTable);
    const [rows] = await db.query<RowDataPacket[]>(sql, [limit]);
    return rows as RecentPostRow[];
}
