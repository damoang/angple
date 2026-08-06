import { describe, expect, it } from 'vitest';
import { parseContentUrl } from './board-content-url';

describe('parseContentUrl', () => {
    it('표준 글 주소', () => {
        expect(parseContentUrl('https://damoang.net/stock/17145')).toEqual({
            boardId: 'stock',
            postId: 17145,
            commentId: null
        });
    });

    it('댓글 앵커 3형태', () => {
        for (const anchor of ['#c_777', '#comment_777', '#comment-777']) {
            expect(parseContentUrl(`https://damoang.net/stock/16734${anchor}`)).toEqual({
                boardId: 'stock',
                postId: 16734,
                commentId: 777
            });
        }
    });

    it('레거시 board.php 주소 (+댓글 앵커)', () => {
        expect(
            parseContentUrl('https://damoang.net/bbs/board.php?bo_table=stock&wr_id=11941')
        ).toEqual({ boardId: 'stock', postId: 11941, commentId: null });
        expect(
            parseContentUrl('https://damoang.net/bbs/board.php?bo_table=stock&wr_id=11941#c_12000')
        ).toEqual({ boardId: 'stock', postId: 11941, commentId: 12000 });
    });

    it('상대경로 수용', () => {
        expect(parseContentUrl('/coffee/123')).toEqual({
            boardId: 'coffee',
            postId: 123,
            commentId: null
        });
    });

    it('외부 호스트 거부', () => {
        expect(parseContentUrl('https://evil.example.com/stock/17145')).toBeNull();
    });

    it('글 번호 아닌 경로·잘못된 입력 거부', () => {
        expect(parseContentUrl('https://damoang.net/stock')).toBeNull();
        expect(parseContentUrl('https://damoang.net/stock/abc')).toBeNull();
        expect(parseContentUrl('')).toBeNull();
        expect(parseContentUrl('not a url')).toBeNull();
    });

    it('보드 슬러그 검증 (인젝션 방지)', () => {
        expect(
            parseContentUrl('https://damoang.net/bbs/board.php?bo_table=a;drop&wr_id=1')
        ).toBeNull();
    });
});
