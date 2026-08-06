/**
 * 게시글/댓글 URL 파서 — 소모임 돌보기(임시 조치)에서 당주가 붙여넣는 주소를 해석한다.
 *
 * 파싱만 담당한다. 어느 보드의 당주인지, 대상이 실존하는지는 호출부(서버)가 검사한다.
 *
 * 수용 형태 (전부 실서비스에서 생성되는 주소들):
 * - https://damoang.net/{board}/{postId}
 * - .../{board}/{postId}#c_{id} · #comment_{id} · #comment-{id}  (댓글 앵커)
 * - 레거시 /bbs/board.php?bo_table={board}&wr_id={postId}(#c_{id})
 * - 도메인 없는 상대경로 /{board}/{postId}
 */

export interface ParsedContentUrl {
    boardId: string;
    postId: number;
    /** 댓글 앵커가 있으면 그 댓글의 wr_id, 없으면 null (= 글 자체) */
    commentId: number | null;
}

const ALLOWED_HOSTS = new Set(['damoang.net', 'www.damoang.net']);
const BOARD_RE = /^[a-zA-Z0-9_]+$/;

function parseCommentAnchor(hash: string): number | null {
    const m = hash.match(/^#(?:c_|comment[_-])(\d+)$/);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseContentUrl(raw: string): ParsedContentUrl | null {
    const input = raw.trim();
    if (!input) return null;

    let url: URL;
    try {
        // 상대경로도 받는다 — 당주가 주소창의 경로만 복사해 오는 경우.
        url = new URL(input, 'https://damoang.net');
    } catch {
        return null;
    }
    if (!ALLOWED_HOSTS.has(url.hostname)) return null;

    // 레거시 그누보드 주소
    if (url.pathname === '/bbs/board.php') {
        const boardId = url.searchParams.get('bo_table') ?? '';
        const postId = Number(url.searchParams.get('wr_id'));
        if (!BOARD_RE.test(boardId) || !Number.isInteger(postId) || postId <= 0) return null;
        return { boardId, postId, commentId: parseCommentAnchor(url.hash) };
    }

    // 표준 /{board}/{postId}
    const m = url.pathname.match(/^\/([a-zA-Z0-9_]+)\/(\d+)\/?$/);
    if (!m) return null;
    const postId = Number(m[2]);
    if (!Number.isInteger(postId) || postId <= 0) return null;
    return { boardId: m[1], postId, commentId: parseCommentAnchor(url.hash) };
}
