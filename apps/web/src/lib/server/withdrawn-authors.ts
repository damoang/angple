/**
 * 작성자 검색용 탈퇴 회원 판정
 *
 * 탈퇴 회원 정보 비노출 정책을 작성자 검색에도 적용한다.
 * 프로필·활동 모아보기는 탈퇴 회원을 이미 가리는데, 작성자 조건 검색(sfl=author 등)으로는
 * 같은 활동을 다시 모아 볼 수 있었다.
 *
 * - 탈퇴 판정 기준은 `g5_member.mb_leave_date` 가 비어 있지 않음(숙려 중 포함) —
 *   `routes/api/members/[id]/_withdrawn.ts` 와 같은 기준.
 * - 작성자 계열 검색에만 쓴다. 제목·본문 검색에는 적용하지 않는다.
 * - 이 모듈의 함수는 조회 실패 시 예외를 그대로 던진다. 호출부는 작성자 검색을
 *   빈 결과로 돌려야 한다(비노출 우선). 응답에 탈퇴 사실을 드러내지 않는다.
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/** 작성자를 기준으로 찾는 검색 필드(sfl) — sphinx-search.ts buildMatchExpr 와 일치 */
export const AUTHOR_SEARCH_FIELDS: ReadonlySet<string> = new Set([
    'author',
    'author_nick',
    'author_id',
    'comment_author',
    'comment_nick',
    'comment_id'
]);

/** 작성자 계열 검색인지 */
export function isAuthorSearchField(field: string | null | undefined): boolean {
    return !!field && AUTHOR_SEARCH_FIELDS.has(field);
}

interface MemberIdRow extends RowDataPacket {
    mb_id: string;
}

/**
 * 검색어가 탈퇴 회원의 아이디 또는 닉네임과 정확히 같은지.
 * 같으면 호출부는 검색을 생략하고 빈 결과를 돌려준다.
 * 조회 실패 시 예외를 던진다.
 */
export async function isWithdrawnSearchTerm(term: string): Promise<boolean> {
    const value = term.trim();
    if (!value) return false;
    const [rows] = await readPool.query<MemberIdRow[]>(
        "SELECT mb_id FROM g5_member WHERE (mb_id = ? OR mb_nick = ?) AND mb_leave_date <> '' LIMIT 1",
        [value, value]
    );
    return rows.length > 0;
}

/**
 * 주어진 회원 아이디 중 탈퇴 회원 아이디 집합(IN 쿼리 1회).
 * 빈 아이디(비회원 글)는 판정 대상이 아니다. 조회 실패 시 예외를 던진다.
 * DB 비교가 대소문자를 구분하지 않으므로 집합은 소문자로 담는다 — 확인은 isWithdrawnAuthor 로.
 */
export async function findWithdrawnMemberIds(mbIds: Iterable<string>): Promise<Set<string>> {
    const ids = [...new Set([...mbIds].filter((id) => typeof id === 'string' && id !== ''))];
    if (ids.length === 0) return new Set();
    const ph = ids.map(() => '?').join(',');
    const [rows] = await readPool.query<MemberIdRow[]>(
        `SELECT mb_id FROM g5_member WHERE mb_id IN (${ph}) AND mb_leave_date <> ''`,
        ids
    );
    return new Set(rows.map((r) => String(r.mb_id).toLowerCase()));
}

/** findWithdrawnMemberIds 결과에 이 작성자가 들어 있는지 */
export function isWithdrawnAuthor(
    withdrawn: ReadonlySet<string>,
    mbId: string | null | undefined
): boolean {
    return !!mbId && withdrawn.has(String(mbId).toLowerCase());
}

interface HitAuthorRow extends RowDataPacket {
    wr_id: number;
    mb_id: string;
}

export interface BoardSearchHits {
    /** 검색에 걸린 행(글 또는 댓글) wr_id — 검색 순서 유지 */
    ids: number[];
    /** 댓글 검색이면 ids 와 같은 순서의 원글 wr_id */
    parentIds?: number[];
}

/**
 * 게시판 검색 결과에서 작성자가 탈퇴 회원인 행을 뺀다.
 * 작성자 조회 1회 + 탈퇴 판정 IN 쿼리 1회. `removed` 는 뺀 행 수(총 건수 보정용).
 * 조회 실패 시 예외를 던진다 — 호출부는 빈 결과로 처리한다.
 */
export async function excludeWithdrawnAuthorHits(
    boardId: string,
    hits: BoardSearchHits
): Promise<BoardSearchHits & { removed: number }> {
    if (!/^[a-zA-Z0-9_]+$/.test(boardId)) {
        throw new Error('invalid board id');
    }
    if (hits.ids.length === 0) {
        return { ids: [], parentIds: hits.parentIds ? [] : undefined, removed: 0 };
    }
    const ph = hits.ids.map(() => '?').join(',');
    const [rows] = await readPool.query<HitAuthorRow[]>(
        `SELECT wr_id, mb_id FROM g5_write_${boardId} WHERE wr_id IN (${ph})`,
        hits.ids
    );
    const authorOf = new Map<number, string>();
    for (const r of rows) authorOf.set(Number(r.wr_id), String(r.mb_id ?? ''));
    const withdrawn = await findWithdrawnMemberIds(authorOf.values());

    const ids: number[] = [];
    const parentIds: number[] = [];
    hits.ids.forEach((id, i) => {
        if (isWithdrawnAuthor(withdrawn, authorOf.get(Number(id)))) return;
        ids.push(id);
        if (hits.parentIds) parentIds.push(hits.parentIds[i]);
    });
    return {
        ids,
        parentIds: hits.parentIds ? parentIds : undefined,
        removed: hits.ids.length - ids.length
    };
}
