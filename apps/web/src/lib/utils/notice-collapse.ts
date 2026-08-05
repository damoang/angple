/**
 * 읽은 공지 접기 규칙.
 *
 * 목록 페이지와 테스트가 **같은 함수를 import** 한다. 규칙을 화면에 인라인으로 두면
 * 테스트가 로직을 복붙하게 되고, 구현이 바뀌어도 테스트는 영원히 초록이다
 * (2026-08-03 blocked-comment-filter 사고).
 *
 * ## 세 가지 상태가 섞인다
 *
 * | hideReadNotices | collapseReadNotices | 펼침 | 읽은 공지 |
 * |---|---|---|---|
 * | 켬 | — | — | 아예 안 보임 (사용자가 그렇게 정했다) |
 * | 끔 | 끔 | — | 그대로 보임 (예전 동작) |
 * | 끔 | 켬 | 접힘 | 개수만 표시 |
 * | 끔 | 켬 | 펼침 | 보임 |
 *
 * ⛔ `hideReadNotices`(완전 숨김)가 접기보다 우선한다. 안 보이기로 한 것을 접기가
 *    되살리면 설정을 무시하는 셈이 된다.
 */

export interface NoticeCollapseState {
    /** 설정 → 화면 설정 → '읽은 공지 숨기기' */
    hideRead: boolean;
    /** 목록 설정 → '읽은 공지 접기' */
    collapseRead: boolean;
    /** 이번 화면에서 사용자가 펼쳤는가 */
    expanded: boolean;
}

/** 읽은 공지 한 건을 지금 감출 것인가 */
export function isReadNoticeHidden(s: NoticeCollapseState): boolean {
    if (s.hideRead) return true;
    if (!s.collapseRead) return false;
    return !s.expanded;
}

/**
 * '펼치기' 버튼에 표시할 개수. 0 이면 버튼을 그리지 않는다.
 *
 * ⛔ hideRead 일 때 0 이어야 한다 — 눌러도 안 펼쳐지므로 고장으로 오해된다.
 */
export function collapsedNoticeCount(s: NoticeCollapseState, readCount: number): number {
    if (s.hideRead || !s.collapseRead || s.expanded) return 0;
    return readCount;
}

/** '접기' 버튼을 보일 것인가 (펼친 뒤 되돌릴 수단) */
export function shouldShowCollapseButton(s: NoticeCollapseState, readCount: number): boolean {
    return s.expanded && readCount > 0 && s.collapseRead && !s.hideRead;
}
