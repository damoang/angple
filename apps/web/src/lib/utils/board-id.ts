/**
 * boardId 유효성 판정.
 *
 * SPA 라우트를 떠난 뒤 뒤늦게 실행되는 비동기 작업이 `data.boardId` 를 읽으면
 * `undefined` 가 되고, 템플릿 리터럴로 URL 을 만들면 문자열 `"undefined"` 가 경로에
 * 박혀 `/api/boards/undefined/...` 같은 요청이 나간다. 서버는 이를 게시판 이름으로
 * 받아 `g5_write_undefined` 를 조회하다 실패한다.
 *
 * 그래서 빈 값뿐 아니라 **`"undefined"`/`"null"` 문자열도 무효**로 본다.
 */
export function isValidBoardId(value: unknown): value is string {
    return (
        typeof value === 'string' && value.length > 0 && value !== 'undefined' && value !== 'null'
    );
}
