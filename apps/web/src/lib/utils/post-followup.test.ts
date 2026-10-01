import { describe, expect, it } from 'vitest';
import { canSkipReactionsRefetch, decideLikeResync, shouldRunLikeFallback } from './post-followup';

describe('shouldRunLikeFallback', () => {
    it('로그인 판정이 끝나기 전에는 부르지 않는다', () => {
        expect(
            shouldRunLikeFallback({
                auxiliaryLoaded: false,
                authLoading: true,
                authenticated: false
            })
        ).toBe(false);
    });

    it('로그인 회원은 부르지 않는다 — 인증 확립 뒤 재조회가 따로 나간다', () => {
        expect(
            shouldRunLikeFallback({
                auxiliaryLoaded: false,
                authLoading: false,
                authenticated: true
            })
        ).toBe(false);
    });

    it('비로그인이고 서버 전달분이 아직 없으면 부른다', () => {
        expect(
            shouldRunLikeFallback({
                auxiliaryLoaded: false,
                authLoading: false,
                authenticated: false
            })
        ).toBe(true);
    });

    it('서버 전달분이 이미 도착했으면 부르지 않는다', () => {
        expect(
            shouldRunLikeFallback({
                auxiliaryLoaded: true,
                authLoading: false,
                authenticated: false
            })
        ).toBe(false);
    });
});

describe('canSkipReactionsRefetch', () => {
    const base = {
        parentId: 'document:free:1',
        streamedParentId: 'document:free:1',
        streamedViewerKnown: false,
        authLoading: false,
        authenticated: false
    };

    it('서버 전달분이 없으면 불러야 한다', () => {
        expect(canSkipReactionsRefetch({ ...base, streamedParentId: null })).toBe(false);
    });

    it('서버 전달분이 다른 글 것이면 불러야 한다', () => {
        expect(canSkipReactionsRefetch({ ...base, streamedParentId: 'document:free:2' })).toBe(
            false
        );
    });

    it('서버가 회원을 알고 조회했으면 다시 부르지 않는다', () => {
        expect(
            canSkipReactionsRefetch({ ...base, streamedViewerKnown: true, authenticated: true })
        ).toBe(true);
    });

    it('비로그인은 서버 전달분으로 충분하다', () => {
        expect(canSkipReactionsRefetch(base)).toBe(true);
    });

    it('서버가 회원을 몰랐는데 브라우저는 로그인 상태면 불러야 한다 — 내 반응 표시가 빠져 있다', () => {
        expect(canSkipReactionsRefetch({ ...base, authenticated: true })).toBe(false);
    });

    it('로그인 판정이 안 끝났고 서버가 회원을 몰랐으면 불러야 한다', () => {
        expect(canSkipReactionsRefetch({ ...base, authLoading: true })).toBe(false);
    });

    it('로그인 판정이 안 끝났어도 서버가 회원을 알았으면 부르지 않는다', () => {
        expect(
            canSkipReactionsRefetch({ ...base, streamedViewerKnown: true, authLoading: true })
        ).toBe(true);
    });
});

describe('decideLikeResync', () => {
    it('서버가 이 회원의 것으로 확정해 보냈으면 다시 받지 않는다', () => {
        expect(decideLikeResync('resolved')).toBe('skip');
    });

    it('서버가 회원을 몰랐거나 조회에 실패했으면 다시 받는다', () => {
        expect(decideLikeResync('unresolved')).toBe('fetch');
    });

    it('서버 전달분이 아직 도착하지 않았으면 기다린다', () => {
        expect(decideLikeResync('pending')).toBe('wait');
    });

    it('이 글에 대한 상태를 아직 모르면 기다린다', () => {
        expect(decideLikeResync(null)).toBe('wait');
    });
});
