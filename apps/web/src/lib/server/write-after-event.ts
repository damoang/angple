/**
 * 웹이 g5_write_* 를 직접 바꾼 뒤 백엔드 후처리 워커에 「바뀌었다」를 알리는 이벤트.
 *
 * 워커(Go WriteAfterWorker)가 이벤트를 집어 가 글·댓글 캐시를 지우고 회원 활동 피드를
 * 다시 맞춘 뒤, 회원 최근 활동 캐시(작성자 활동 패널·프로필)까지 지운다.
 * 웹 댓글 삭제 경로가 같은 형태로 이벤트를 남긴다(comments/[commentId]/+server.ts).
 *
 * ⛔ 쓰기가 커밋된 뒤에 부른다. 실패해도 예외를 던지지 않는다 — 쓰기는 이미 끝났고
 *    캐시는 TTL 로 만료된다(최악은 몇 분 늦게 반영).
 */
import pool from '$lib/server/db';

export interface WriteChangedTarget {
    boardId: string;
    /** 바뀐 글 또는 댓글의 wr_id */
    wrId: number;
    /** 댓글이면 부모 글 wr_id (워커가 댓글 이벤트에 요구한다) */
    postId: number;
    isComment: boolean;
    mbId: string;
    author: string;
    /** 글이면 제목. 댓글은 빈 문자열. */
    subject?: string;
}

type QueryFn = (sql: string, params: unknown[]) => Promise<unknown>;

const defaultQuery: QueryFn = (sql, params) => pool.query(sql, params);

export async function enqueueWriteChangedEvent(
    target: WriteChangedTarget,
    query: QueryFn = defaultQuery
): Promise<boolean> {
    const eventType = target.isComment ? 'comment_updated' : 'post_updated';
    const subject = target.isComment ? '' : target.subject || '';
    try {
        await query(
            `INSERT INTO g5_write_after_events
                (event_type, board_slug, write_id, post_id, member_id, author, subject, occurred_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
            [
                eventType,
                target.boardId,
                target.wrId,
                target.isComment ? target.postId : null,
                target.mbId,
                target.author,
                subject
            ]
        );
        return true;
    } catch (e) {
        console.error('[write-after-event] enqueue 실패:', target.boardId, target.wrId, e);
        return false;
    }
}
