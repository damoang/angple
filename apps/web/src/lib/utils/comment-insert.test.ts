import { describe, expect, it } from 'vitest';
import { insertReplyAfterParent, type CommentLike } from './comment-insert';

const root = (id: number): CommentLike => ({ id, depth: 0, parent_id: 100 });
const reply = (id: number, depth = 1, parent_id: number = 0): CommentLike => ({
    id,
    depth,
    parent_id
});

describe('insertReplyAfterParent', () => {
    it('루트 댓글 한개에 대댓글이 처음 달릴 때 부모 바로 다음에 삽입된다', () => {
        const list: CommentLike[] = [root(1), root(2)];
        const newReply: CommentLike = { id: 3, depth: 1 };
        const result = insertReplyAfterParent(list, 1, newReply);
        expect(result.map((c) => c.id)).toEqual([1, 3, 2]);
    });

    it('이미 자식이 있는 부모에 대댓글이 추가될 때 마지막 자식 다음에 삽입된다', () => {
        const list: CommentLike[] = [root(1), reply(11, 1), reply(12, 1), root(2)];
        const newReply: CommentLike = { id: 99, depth: 1 };
        const result = insertReplyAfterParent(list, 1, newReply);
        expect(result.map((c) => c.id)).toEqual([1, 11, 12, 99, 2]);
    });

    it('대대댓글이 있는 부모 서브트리 끝에 삽입된다', () => {
        const list: CommentLike[] = [
            root(1),
            reply(11, 1),
            reply(111, 2), // 11 의 자식
            reply(12, 1),
            root(2)
        ];
        const newReply: CommentLike = { id: 99, depth: 1 };
        const result = insertReplyAfterParent(list, 1, newReply);
        // 99 는 1 의 마지막 자식(12) 다음, 2 직전
        expect(result.map((c) => c.id)).toEqual([1, 11, 111, 12, 99, 2]);
    });

    it('parent_id 가 list 에 없으면 끝에 추가된다 (graceful fallback)', () => {
        const list: CommentLike[] = [root(1)];
        const newReply: CommentLike = { id: 99, depth: 1 };
        const result = insertReplyAfterParent(list, 999, newReply);
        expect(result.map((c) => c.id)).toEqual([1, 99]);
    });

    it('동일 id 가 이미 있으면 중복 추가하지 않는다', () => {
        const list: CommentLike[] = [root(1), reply(11, 1)];
        const result = insertReplyAfterParent(list, 1, { id: 11, depth: 1 });
        expect(result).toBe(list);
    });

    it('parentId 가 string 이고 comments id 가 number 여도 정상 동작한다', () => {
        const list: CommentLike[] = [root(1), root(2)];
        const newReply: CommentLike = { id: 3, depth: 1 };
        const result = insertReplyAfterParent(list, '1', newReply);
        expect(result.map((c) => c.id)).toEqual([1, 3, 2]);
    });

    it('depth 가 누락된 (undefined) 부모도 depth 0 으로 간주한다', () => {
        const list: CommentLike[] = [
            { id: 1 }, // depth undefined
            { id: 2 }
        ];
        const newReply: CommentLike = { id: 3, depth: 1 };
        const result = insertReplyAfterParent(list, 1, newReply);
        expect(result.map((c) => c.id)).toEqual([1, 3, 2]);
    });
});
