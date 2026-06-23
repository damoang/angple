import { invalidateAll } from '$app/navigation';

/**
 * 사이드바 게시판 링크 클릭 처리 (#12778).
 *
 * #1635 에서 사이드바 보드 링크의 `rel="external"`(전체 리로드 → 깜빡임)을 제거해
 * SPA 네비게이션으로 바꾼 뒤, 이미 보고 있는 게시판 목록(같은 URL)을 다시 클릭하면
 * 라우터가 같은 경로로의 네비게이션을 무시해 목록이 전혀 갱신되지 않는 문제가 생겼다
 * ("자유게시판을 눌러도 새 글이 안 올라온다, F5 하거나 다른 곳에 갔다 와야 한다").
 *
 * 같은 경로일 때만 `invalidateAll()` 로 load 를 재실행해 새 글을 불러온다. 전체 페이지
 * 리로드가 아니므로 #1635 의 깜빡임은 재발하지 않는다. 다른 경로(게시글 등)에서의 클릭은
 * 평소대로 SPA 네비게이션이 일어나 load 가 자연히 재실행되므로 손대지 않는다.
 */
export function handleBoardLinkClick(
    event: MouseEvent,
    boardId: string,
    currentPathname: string
): void {
    // 새 탭/창 등 보조 클릭이나 수정키 동반 클릭은 브라우저 기본 동작을 보존한다.
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return;
    }
    if (currentPathname === `/${boardId}`) {
        event.preventDefault();
        void invalidateAll();
    }
}
