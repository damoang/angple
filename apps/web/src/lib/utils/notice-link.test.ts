import { describe, it, expect } from 'vitest';
import { getNoticeHref, sanitizeFromBoard } from './notice-link';

describe('getNoticeHref', () => {
    it('일반 공지는 지금 보고 있는 게시판으로 링크한다', () => {
        expect(getNoticeHref({ id: 123 }, 'car')).toBe('/car/123');
    });

    it('전역 공지는 원본 게시판으로 가되 유입 소모임을 붙인다', () => {
        const href = getNoticeHref(
            { id: 18300, global_notice: true, source_board: 'notice' },
            'car'
        );
        expect(href).toBe('/notice/18300?from=car');
    });

    it('source_board 가 없으면 전역 공지라도 현재 게시판으로 폴백한다 (백엔드 미배포 안전)', () => {
        expect(getNoticeHref({ id: 5, global_notice: true }, 'stock')).toBe('/stock/5');
    });

    it('소모임 slug 를 URL 인코딩한다', () => {
        const href = getNoticeHref({ id: 1, global_notice: true, source_board: 'notice' }, 'a b');
        expect(href).toBe('/notice/1?from=a%20b');
    });
});

describe('sanitizeFromBoard', () => {
    it('정상 slug 는 통과', () => {
        expect(sanitizeFromBoard('car')).toBe('car');
        expect(sanitizeFromBoard('reading_books')).toBe('reading_books');
        expect(sanitizeFromBoard('plastic-model')).toBe('plastic-model');
    });

    it('빈 값은 undefined', () => {
        expect(sanitizeFromBoard(null)).toBeUndefined();
        expect(sanitizeFromBoard(undefined)).toBeUndefined();
        expect(sanitizeFromBoard('')).toBeUndefined();
    });

    it('경로 조작·특수문자는 버린다', () => {
        expect(sanitizeFromBoard('../admin')).toBeUndefined();
        expect(sanitizeFromBoard('car/../free')).toBeUndefined();
        expect(sanitizeFromBoard('<script>')).toBeUndefined();
        expect(sanitizeFromBoard('a'.repeat(41))).toBeUndefined();
    });
});
