import { describe, it, expect } from 'vitest';
import { mapGnuboardUrl, mapRhymixUrl } from './url-compat';

function params(obj: Record<string, string>): URLSearchParams {
    return new URLSearchParams(obj);
}

describe('mapGnuboardUrl', () => {
    describe('게시판 (board.php)', () => {
        it('게시판 목록', () => {
            expect(mapGnuboardUrl('/bbs/board.php', params({ bo_table: 'free' }))).toBe('/free');
        });

        it('게시판 + 게시글', () => {
            expect(
                mapGnuboardUrl('/bbs/board.php', params({ bo_table: 'free', wr_id: '123' }))
            ).toBe('/free/123');
        });

        it('게시판 + 페이지 (2페이지 이상)', () => {
            expect(
                mapGnuboardUrl('/bbs/board.php', params({ bo_table: 'free', page: '3' }))
            ).toBe('/free?page=3');
        });

        it('게시판 + 1페이지는 페이지 파라미터 생략', () => {
            expect(
                mapGnuboardUrl('/bbs/board.php', params({ bo_table: 'free', page: '1' }))
            ).toBe('/free');
        });

        it('bo_table 없으면 null', () => {
            expect(mapGnuboardUrl('/bbs/board.php', params({}))).toBeNull();
        });
    });

    describe('글쓰기 (write.php)', () => {
        it('글쓰기 페이지', () => {
            expect(mapGnuboardUrl('/bbs/write.php', params({ bo_table: 'free' }))).toBe(
                '/free/write'
            );
        });

        it('글 수정 (wr_id 포함)', () => {
            expect(
                mapGnuboardUrl('/bbs/write.php', params({ bo_table: 'free', wr_id: '456' }))
            ).toBe('/free/456/edit');
        });

        it('bo_table 없으면 null', () => {
            expect(mapGnuboardUrl('/bbs/write.php', params({}))).toBeNull();
        });
    });

    describe('인증 페이지', () => {
        it('로그인', () => {
            expect(mapGnuboardUrl('/bbs/login.php', params({}))).toBe('/login');
        });

        it('회원가입', () => {
            expect(mapGnuboardUrl('/bbs/register.php', params({}))).toBe('/register');
        });

        it('마이페이지', () => {
            expect(mapGnuboardUrl('/bbs/member_confirm.php', params({}))).toBe('/my/settings');
        });
    });

    describe('프로필 (profile.php)', () => {
        it('프로필 페이지', () => {
            expect(mapGnuboardUrl('/bbs/profile.php', params({ mb_id: 'user1' }))).toBe(
                '/members/user1'
            );
        });

        it('mb_id 없으면 null', () => {
            expect(mapGnuboardUrl('/bbs/profile.php', params({}))).toBeNull();
        });
    });

    describe('검색 (search.php)', () => {
        it('검색어(stx) 있으면 매핑', () => {
            expect(mapGnuboardUrl('/bbs/search.php', params({ stx: '테스트' }))).toBe(
                `/search?q=${encodeURIComponent('테스트')}`
            );
        });

        it('sfl만 있을 때도 매핑', () => {
            expect(mapGnuboardUrl('/bbs/search.php', params({ sfl: 'subject' }))).toBe(
                `/search?q=${encodeURIComponent('subject')}`
            );
        });

        it('검색어 없으면 /search', () => {
            expect(mapGnuboardUrl('/bbs/search.php', params({}))).toBe('/search');
        });
    });

    describe('콘텐츠 (content.php)', () => {
        it('co_id 있으면 /pages로 매핑', () => {
            expect(mapGnuboardUrl('/bbs/content.php', params({ co_id: 'about' }))).toBe(
                '/pages/about'
            );
        });

        it('co_id 없으면 null', () => {
            expect(mapGnuboardUrl('/bbs/content.php', params({}))).toBeNull();
        });
    });

    describe('기타 페이지', () => {
        it('FAQ', () => {
            expect(mapGnuboardUrl('/bbs/faq.php', params({}))).toBe('/faq');
        });

        it('QA 작성', () => {
            expect(mapGnuboardUrl('/bbs/qa_write.php', params({}))).toBe('/qa/write');
        });
    });

    describe('알 수 없는 경로', () => {
        it('매핑 없는 경로는 null', () => {
            expect(mapGnuboardUrl('/bbs/unknown.php', params({}))).toBeNull();
        });

        it('루트 경로는 null', () => {
            expect(mapGnuboardUrl('/', params({}))).toBeNull();
        });
    });
});

describe('mapRhymixUrl', () => {
    it('index.php + mid + document_srl → /mid/srl', () => {
        expect(
            mapRhymixUrl('/index.php', params({ mid: 'board', document_srl: '123' }))
        ).toBe('/board/123');
    });

    it('index.php + mid만 → /mid', () => {
        expect(mapRhymixUrl('/index.php', params({ mid: 'board' }))).toBe('/board');
    });

    it('/ + mid + document_srl → /mid/srl', () => {
        expect(mapRhymixUrl('/', params({ mid: 'notice', document_srl: '456' }))).toBe(
            '/notice/456'
        );
    });

    it('/ + mid만 → /mid', () => {
        expect(mapRhymixUrl('/', params({ mid: 'notice' }))).toBe('/notice');
    });

    it('mid 없으면 null', () => {
        expect(mapRhymixUrl('/index.php', params({}))).toBeNull();
    });

    it('/ + 파라미터 없으면 null', () => {
        expect(mapRhymixUrl('/', params({}))).toBeNull();
    });

    it('다른 경로는 null', () => {
        expect(mapRhymixUrl('/other', params({ mid: 'board' }))).toBeNull();
    });
});
