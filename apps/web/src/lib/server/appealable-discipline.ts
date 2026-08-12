/**
 * 소명 가능한 최근 이용제한 기록 찾기.
 *
 * 소명 글쓰기 화면은 `?disciplinelog_id=` 가 붙어 있을 때만 제목·본문을 채운다.
 * 그런데 회원이 소명게시판에서 **직접 글쓰기**로 들어오면 그 값이 없어 제목이 빈 채로
 * 남는다. 실제로 claim/1733 이 그렇게 작성돼 최근 10건 중 혼자만 제목 형식이 달랐다
 * (나머지는 전부 "이용제한 NNNN번에 대한 소명").
 *
 * 운영 입장에서도 제목만 보고 어느 처분에 대한 소명인지 알 수 있어야 처리가 빠르다.
 * 그래서 값이 없으면 **본인의 소명 가능한 최근 기록**을 찾아 채운다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

export interface AppealableDiscipline {
    id: number;
    /** 'YYYY-MM-DD' */
    penaltyDateFrom: string;
    /** -1=영구 · 0=주의 · 1 이상=기간제 */
    penaltyPeriod: number;
}

/**
 * 이 회원이 지금 소명할 수 있는 가장 최근 이용제한.
 *
 * 조건 — 이용제한 기록 상세의 소명 버튼과 같은 기준을 쓴다:
 * - ⛔ **주의(0일)는 제외.** 운영 관행상 소명 대상이 아니다
 * - 제재일부터 **15일 이내**(제12~17조). 제재 당일(0일차)도 포함한다
 * - 이미 소명글을 낸 건은 제외 — 같은 처분에 두 번 쓰게 하지 않는다
 *
 * ⛔ 조회가 실패하면 null 을 돌려 **아무것도 채우지 않는다.** 자동 채움은 편의이지
 *    필수가 아니므로, 실패를 이유로 글쓰기를 막지 않는다.
 */
export async function findAppealableDiscipline(mbId: string): Promise<AppealableDiscipline | null> {
    if (!mbId) return null;
    try {
        // ⛔ wr_content 에 JSON 이 아닌 행이 섞여 있다(빈 문자열 2건 확인).
        //    WHERE 절에서 JSON_EXTRACT 를 바로 쓰면 "Invalid JSON text" 로 쿼리 전체가 죽는다.
        //    회원 식별은 STORED GENERATED 컬럼 `penalty_mb_id`(인덱스 있음)로 하고,
        //    JSON 은 유효한 행에서만 JSON_VALID 가드를 통과한 뒤 읽는다.
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, from_at, period FROM (
                 SELECT d.wr_id AS id,
                        CASE WHEN JSON_VALID(d.wr_content)
                             THEN JSON_UNQUOTE(JSON_EXTRACT(d.wr_content, '$.penalty_date_from'))
                        END AS from_at,
                        CASE WHEN JSON_VALID(d.wr_content)
                             THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(d.wr_content, '$.penalty_period')) AS SIGNED)
                        END AS period
                   FROM g5_write_disciplinelog d
                  WHERE d.wr_is_comment = 0
                    AND d.penalty_mb_id = ?
                    AND d.wr_datetime >= DATE_SUB(NOW(), INTERVAL 15 DAY)
                    AND NOT EXISTS (
                          SELECT 1 FROM g5_write_claim c
                           WHERE c.wr_is_comment = 0
                             AND c.mb_id = ?
                             AND c.wr_content LIKE CONCAT('%disciplinelog/', d.wr_id, '%')
                        )
               ) t
              WHERE t.period IS NOT NULL AND t.period <> 0
              ORDER BY t.id DESC
              LIMIT 1`,
            [mbId, mbId]
        );
        if (rows.length === 0) return null;
        const r = rows[0];
        return {
            id: Number(r.id),
            penaltyDateFrom: String(r.from_at ?? '').slice(0, 10),
            penaltyPeriod: Number(r.period ?? 0)
        };
    } catch {
        // 자동 채움은 편의 기능이다 — 실패해도 글쓰기를 막지 않는다
        return null;
    }
}
