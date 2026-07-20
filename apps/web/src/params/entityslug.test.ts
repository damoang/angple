import { describe, it, expect } from 'vitest';
import { match } from './entityslug';

describe('entityslug 매처 — /angtt/[slug] 가 다른 라우트를 섀도잉하지 않아야 한다', () => {
    it('작품 slug 는 매칭된다', () => {
        expect(match('호프')).toBe(true);
        expect(match('동궁')).toBe(true);
        expect(match('movie-1987')).toBe(true);
    });

    it('숫자 ID 는 매칭되지 않는다 (angtt 게시판 글 URL 보호)', () => {
        expect(match('7297')).toBe(false);
        expect(match('13')).toBe(false);
    });

    // 2026-07-20 실장애: /angtt/write 가 작품 페이지로 잡혀 글쓰기가 404 였다.
    it('⛔ [boardId] 아래 정적 라우트 이름은 매칭되지 않는다 — 글쓰기 404 방지', () => {
        expect(match('write')).toBe(false);
        expect(match('WRITE')).toBe(false);
    });

    it('빈 문자열은 매칭되지 않는다', () => {
        expect(match('')).toBe(false);
    });
});
