/**
 * 게시판 목록 페이지 크기 (단일 출처).
 *
 * 게시판 목록 페이지([boardId])와 글 상세 하단 목록(RecentPosts)이 같은 값을
 * 써야 같은 글이 같은 page 위치에 표시된다. 값이 다르면 페이지가 넘어갈수록
 * offset 차이가 누적돼 글이 겹치거나 누락된다 (#12571).
 */
export const BOARD_LIST_PAGE_SIZE = 24;
