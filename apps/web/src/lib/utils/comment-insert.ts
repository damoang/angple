/**
 * 대댓글(reply) optimistic update 시 부모 댓글의 서브트리 끝 위치에
 * 새 reply 를 끼워넣는 헬퍼.
 *
 * - 백엔드 v1 createComment 응답에 `parent_id` 와 `wr_comment_reply` 가 없어
 *   단순 push 로 끝에 추가하면 commentTree 의 hasApiDepth 분기에서 부모 다음이
 *   아닌 배열 맨 끝에 렌더되어 사용자에게는 reply 가 안 보이는 것처럼 인지된다.
 *   (#12228)
 * - 본 헬퍼는 부모 댓글 인덱스를 기준으로 자식들의 마지막 다음 위치
 *   (= 부모 depth 이하 댓글 직전) 에 삽입하여 그누보드 표시 순서를 보존한다.
 */
export interface CommentLike {
    id: string | number;
    depth?: number;
    parent_id?: string | number | null;
    [key: string]: unknown;
}

export function insertReplyAfterParent<T extends CommentLike>(
    comments: T[],
    parentId: string | number,
    optimistic: T
): T[] {
    // 중복 방지
    if (comments.some((c) => c.id === optimistic.id)) {
        return comments;
    }

    const parentIdx = comments.findIndex((c) => String(c.id) === String(parentId));
    if (parentIdx === -1) {
        return [...comments, optimistic];
    }

    const parentDepth = comments[parentIdx].depth ?? 0;
    let insertIdx = parentIdx + 1;
    while (insertIdx < comments.length && (comments[insertIdx].depth ?? 0) > parentDepth) {
        insertIdx++;
    }

    return [...comments.slice(0, insertIdx), optimistic, ...comments.slice(insertIdx)];
}
