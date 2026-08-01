/**
 * 게시판 목록 재사용(carryover) — 클라이언트 메모리 전용.
 *
 * 목록 → 글 상세로 이동하는 사용자는 방금 그 목록을 보고 있었다. 그 데이터를 버리지 않고
 * 들고 가면 상세 하단 목록을 **요청 0회로 즉시** 그릴 수 있다(스켈레톤 제거).
 *
 * 왜 SSR 주입(initialPosts)이 아니라 클라 스토어인가:
 * - 글 상세 HTML 은 익명 사용자에게 캐시된다. 목록을 SSR 에 실으면 캐시가 사는 동안
 *   하단 목록이 굳는다(#12315 "특정 날짜 글 고정 노출" 실사고). 이 스토어는 사용자
 *   본인이 몇 초 전에 본 데이터만 본인에게 보여주므로 그 문제가 원천적으로 없다.
 * - __data.json 에 목록 24건을 싣지 않아 payload 도 늘지 않는다.
 *
 * 원칙:
 * - 순수 목록 화면(쿼리가 page 뿐)에서만 기억한다 — 검색·카테고리·작성자필터·날짜 화면은
 *   상세 하단이 가져올 "일반 목록"과 다르므로 재사용하면 틀린 화면이 된다.
 * - TTL 60초. 지나면 폴백(fetch)이 항상 있다 — 스토어가 비면 지금과 동일하게 동작한다.
 * - 비파괴 읽기 — 같은 목록에서 여러 글을 연달아 볼 수 있다.
 */
import type { FreePost } from '$lib/api/types.js';

export interface CarriedBoardList {
    boardId: string;
    page: number;
    posts: FreePost[];
    total: number;
    totalPages: number;
    savedAt: number;
}

const TTL_MS = 60_000;

let entry: CarriedBoardList | null = null;

export function rememberBoardList(input: Omit<CarriedBoardList, 'savedAt'>): void {
    if (!input.posts.length) return;
    entry = { ...input, savedAt: Date.now() };
}

export function takeBoardList(boardId: string): CarriedBoardList | null {
    if (!entry) return null;
    if (entry.boardId !== boardId) return null;
    if (Date.now() - entry.savedAt > TTL_MS) {
        entry = null;
        return null;
    }
    // 배열은 복사해 소비 측 재대입/변형이 스토어·목록 페이지 데이터와 얽히지 않게 한다.
    return { ...entry, posts: [...entry.posts] };
}

/** 테스트용 초기화 */
export function clearBoardListCarryover(): void {
    entry = null;
}
