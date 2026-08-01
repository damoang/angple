/**
 * 내가 신고한 목록 (/my/reports) 데이터 접근.
 *
 * ⛔ 처리 결과는 **조회 자체를 하지 않는다.** `g5_na_singo` 의 processed·monitoring_*·admin_*·
 *    hold 는 SELECT 컬럼에 없다 — "무엇을 신고했는지"까지만 보여준다는 정책(신고자 통보 금지
 *    원칙과의 충돌 회피)을 쿼리 수준에서 강제한다. `SELECT *` 로 바꾸는 순간 정책이 깨진다.
 *
 * 그룹핑: 제출 한 번에 사유(sg_type)별로 행이 여러 개 들어가지만(백엔드가 사유 루프 INSERT),
 * 같은 제출은 (sg_table, sg_id, mb_id) 중복 차단 + 단일 now 공유이므로
 * (sg_table, sg_id) 그룹이 정확히 "신고 1건"이다.
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { findDisciplinedIds, DISCIPLINED_TITLE } from '$lib/server/discipline-mask.js';

const SAFE_TABLE_RE = /^[a-zA-Z0-9_]+$/;

/** 대괄호 = 상태 표기 규약(#13097 계열). 삭제·비밀은 제목을 노출하지 않고 링크도 걸지 않는다. */
const LABEL_DELETED_POST = '[삭제된 게시물]';
const LABEL_SECRET_POST = '[비밀글]';
const LABEL_NO_TITLE = '(제목 없음)';

export interface MyReportItem {
    boardId: string;
    /** 신고 대상 wr_id — (boardId, targetId) 가 그룹 PK 라 목록 키로 안전하다 */
    targetId: number;
    boardName: string;
    /** 'post' | 'comment' */
    targetType: 'post' | 'comment';
    /** 마스킹이 끝난 표시 제목 (댓글이면 원글 제목) */
    title: string;
    /** null 이면 링크를 걸지 않는다(삭제·비밀) */
    href: string | null;
    /** 신고한 댓글이 그 뒤 삭제된 경우 */
    commentDeleted: boolean;
    /** 사유 코드들 — 라벨 변환은 클라이언트 `getReportReasonLabel` 몫 */
    reasonCodes: number[];
    /** 내가 적은 상세 사유 (내 입력물) */
    detail: string;
    reportedAt: string;
}

export interface MyReportsResult {
    items: MyReportItem[];
    total: number;
    page: number;
    totalPages: number;
    /** ⛔ 조회 실패를 0건으로 위장하지 않는다 — UI 가 이 필드로 분기한다 */
    error: boolean;
}

interface GroupRow extends RowDataPacket {
    sg_table: string;
    sg_id: number;
    sg_parent: number;
    sg_time: Date | string;
    sg_desc: string | null;
    types: string;
}

interface WriteRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string | null;
    wr_option: string | null;
    wr_deleted_at: Date | string | null;
    wr_is_comment: number;
}

/** search/+server.ts 선례와 같은 판정식 — '0000-00-00' 과 빈 문자열은 살아있는 글로 본다 */
function isDeleted(v: unknown): boolean {
    return v !== null && v !== undefined && String(v) !== '0000-00-00 00:00:00' && String(v) !== '';
}

export async function getMyReports(
    mbId: string,
    page: number,
    limit = 20
): Promise<MyReportsResult> {
    const offset = (Math.max(1, page) - 1) * limit;
    const empty: MyReportsResult = { items: [], total: 0, page, totalPages: 1, error: false };

    let groups: GroupRow[];
    let total: number;
    try {
        // sg_flag=0 — 게시물(글·댓글)만. 1·2 는 앙몰 상품후기/문의로 대상 테이블 체계가 다르다.
        const [[countRows], [rows]] = await Promise.all([
            readPool.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT sg_table, sg_id) AS total
                   FROM g5_na_singo
                  WHERE mb_id = ? AND sg_flag = 0`,
                [mbId]
            ),
            readPool.query<GroupRow[]>(
                `SELECT sg_table, sg_id,
                        MIN(sg_parent) AS sg_parent,
                        MIN(sg_time)   AS sg_time,
                        MIN(sg_desc)   AS sg_desc,
                        GROUP_CONCAT(DISTINCT sg_type ORDER BY sg_type) AS types
                   FROM g5_na_singo
                  WHERE mb_id = ? AND sg_flag = 0
                  GROUP BY sg_table, sg_id
                  ORDER BY sg_time DESC
                  LIMIT ?, ?`,
                [mbId, offset, limit]
            )
        ]);
        total = Number(countRows[0]?.total ?? 0);
        groups = rows;
    } catch (err) {
        console.error('[my-reports] 목록 조회 실패:', err);
        return { ...empty, error: true };
    }
    if (groups.length === 0) {
        return { ...empty, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    // ── 대상 글 배치 조회 (보드별 IN — scrap.ts·new-posts.ts 관용구) ──
    // 댓글 신고는 댓글 행(sg_id)과 원글 행(sg_parent) 둘 다 필요하다:
    // 제목은 원글에서, "댓글이 그 뒤 삭제됐는지"는 댓글 행에서 본다.
    const idsByTable = new Map<string, Set<number>>();
    for (const g of groups) {
        if (!SAFE_TABLE_RE.test(g.sg_table)) continue;
        const set = idsByTable.get(g.sg_table) ?? new Set<number>();
        set.add(g.sg_id);
        if (g.sg_parent) set.add(g.sg_parent);
        idsByTable.set(g.sg_table, set);
    }

    const writeMap = new Map<string, WriteRow>(); // "table:wrId"
    const disciplinedMap = new Map<string, Set<number>>(); // table → wr_id 집합
    const boardNames = new Map<string, string>();

    await Promise.all([
        ...[...idsByTable.entries()].map(async ([table, ids]) => {
            try {
                const [rows] = await readPool.query<WriteRow[]>(
                    `SELECT wr_id, wr_subject, wr_option, wr_deleted_at, wr_is_comment
                       FROM \`g5_write_${table}\`
                      WHERE wr_id IN (?)`,
                    [[...ids]]
                );
                for (const r of rows) writeMap.set(`${table}:${r.wr_id}`, r);
            } catch {
                // 보드가 삭제돼 테이블이 없으면 대상도 '[삭제된 게시물]' 로 떨어진다
            }
            try {
                disciplinedMap.set(table, await findDisciplinedIds(table, [...ids]));
            } catch {
                disciplinedMap.set(table, new Set());
            }
        }),
        (async () => {
            try {
                const [rows] = await readPool.query<RowDataPacket[]>(
                    `SELECT bo_table, bo_subject FROM g5_board WHERE bo_table IN (?)`,
                    [[...idsByTable.keys()]]
                );
                for (const r of rows) boardNames.set(String(r.bo_table), String(r.bo_subject));
            } catch {
                // 이름을 못 얻으면 bo_table 원문으로 표기
            }
        })()
    ]);

    const items: MyReportItem[] = groups.map((g) => {
        const isComment = g.sg_id !== g.sg_parent && g.sg_parent > 0;
        const titleSourceId = isComment ? g.sg_parent : g.sg_id;
        const post = writeMap.get(`${g.sg_table}:${titleSourceId}`);
        const commentRow = isComment ? writeMap.get(`${g.sg_table}:${g.sg_id}`) : undefined;
        const disciplined = disciplinedMap.get(g.sg_table) ?? new Set<number>();

        // 대상 상태 재판정 — 신고 시점의 제목이 아니라 **지금 상태** 기준. 신고 후 글이
        // 삭제·비밀 처리됐다면 이 목록이 원제목 유출 통로가 되면 안 된다.
        let title: string;
        let href: string | null;
        if (!post || isDeleted(post.wr_deleted_at)) {
            title = LABEL_DELETED_POST;
            href = null;
        } else if ((post.wr_option ?? '').includes('secret')) {
            title = LABEL_SECRET_POST;
            href = null;
        } else if (disciplined.has(titleSourceId)) {
            // 근거글은 상세가 blur+워터마크로 열리는 정책이라 링크는 유지한다
            title = DISCIPLINED_TITLE;
            href = isComment
                ? `/${g.sg_table}/${g.sg_parent}#c_${g.sg_id}`
                : `/${g.sg_table}/${g.sg_id}`;
        } else {
            title = (post.wr_subject ?? '').trim() || LABEL_NO_TITLE;
            href = isComment
                ? `/${g.sg_table}/${g.sg_parent}#c_${g.sg_id}`
                : `/${g.sg_table}/${g.sg_id}`;
        }

        const commentDeleted = isComment && (!commentRow || isDeleted(commentRow.wr_deleted_at));
        // 삭제된 댓글의 앵커는 죽어 있다 — 원글이 살아 있으면 앵커만 뗀다
        if (commentDeleted && href) href = `/${g.sg_table}/${g.sg_parent}`;

        return {
            boardId: g.sg_table,
            targetId: g.sg_id,
            boardName: boardNames.get(g.sg_table) ?? g.sg_table,
            targetType: isComment ? 'comment' : 'post',
            title,
            href,
            commentDeleted,
            reasonCodes: String(g.types ?? '')
                .split(',')
                .map(Number)
                .filter((n) => Number.isFinite(n)),
            detail: (g.sg_desc ?? '').trim(),
            reportedAt: new Date(g.sg_time).toISOString()
        };
    });

    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)), error: false };
}
