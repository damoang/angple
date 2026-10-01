import { describe, expect, it } from 'vitest';
import {
    canSkipReactionsRefetch,
    commentIdsForLikersPreview,
    commentLikerIdsToFetch,
    decidePostLikers,
    isLikersPreview,
    shouldPreviewPostLikers,
    shouldRunLikeFallback
} from './post-followup';

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

describe('shouldPreviewPostLikers', () => {
    it('세션 회원이고 추천이 있으면 싣는다', () => {
        expect(shouldPreviewPostLikers({ sessionUserId: 'u1', postLikes: 3 })).toBe(true);
    });

    it('세션 회원이 아니면 싣지 않는다 — 캐시되는 페이지에 신원이 실리면 안 된다', () => {
        expect(shouldPreviewPostLikers({ sessionUserId: null, postLikes: 3 })).toBe(false);
        expect(shouldPreviewPostLikers({ sessionUserId: undefined, postLikes: 3 })).toBe(false);
        expect(shouldPreviewPostLikers({ sessionUserId: '', postLikes: 3 })).toBe(false);
    });

    it('추천이 없으면 싣지 않는다', () => {
        expect(shouldPreviewPostLikers({ sessionUserId: 'u1', postLikes: 0 })).toBe(false);
        expect(shouldPreviewPostLikers({ sessionUserId: 'u1', postLikes: undefined })).toBe(false);
    });
});

describe('commentIdsForLikersPreview', () => {
    const comments = [
        { id: 1, likes: 2 },
        { id: '2', likes: 0 },
        { id: 3 },
        { id: '4', likes: 1 },
        { id: 'x', likes: 5 },
        { id: 5, likes: 9 }
    ];

    it('세션 회원이 아니면 빈 목록', () => {
        expect(commentIdsForLikersPreview({ sessionUserId: null, comments, max: 50 })).toEqual([]);
        expect(commentIdsForLikersPreview({ sessionUserId: '', comments, max: 50 })).toEqual([]);
    });

    it('추천이 있는 댓글만, 숫자 ID 만', () => {
        expect(commentIdsForLikersPreview({ sessionUserId: 'u1', comments, max: 50 })).toEqual([
            1, 4, 5
        ]);
    });

    it('한도에서 자른다', () => {
        expect(commentIdsForLikersPreview({ sessionUserId: 'u1', comments, max: 2 })).toEqual([
            1, 4
        ]);
    });
});

describe('decidePostLikers', () => {
    it('미리보기가 실려 왔으면 그것을 쓴다 — 추천인이 0명이어도', () => {
        expect(decidePostLikers({ preview: { likers: [], total: 0 }, postLikes: 0 })).toBe(
            'use-preview'
        );
        expect(decidePostLikers({ preview: { likers: [{}], total: 4 }, postLikes: 4 })).toBe(
            'use-preview'
        );
    });

    it('미리보기가 없고 추천이 있으면 따로 부른다', () => {
        expect(decidePostLikers({ preview: null, postLikes: 2 })).toBe('fetch');
        expect(decidePostLikers({ preview: undefined, postLikes: 2 })).toBe('fetch');
    });

    it('미리보기가 없고 추천도 없으면 아무것도 하지 않는다', () => {
        expect(decidePostLikers({ preview: null, postLikes: 0 })).toBe('none');
        expect(decidePostLikers({ preview: undefined, postLikes: undefined })).toBe('none');
    });

    it('모양이 다른 값은 미리보기로 치지 않는다', () => {
        expect(isLikersPreview({ likers: 'x', total: 1 })).toBe(false);
        expect(isLikersPreview({ likers: [] })).toBe(false);
        expect(isLikersPreview('preview')).toBe(false);
        expect(decidePostLikers({ preview: { likers: [] }, postLikes: 1 })).toBe('fetch');
    });
});

describe('commentLikerIdsToFetch', () => {
    const comments = [{ id: 1, likes: 2 }, { id: 2, likes: 0 }, { id: 3, likes: 1 }, { id: 4 }];
    const base = {
        previewPending: false,
        comments,
        loaded: new Set<string>(),
        inflight: new Set<string>(),
        attempts: new Map<string, number>(),
        maxAttempts: 4
    };

    it('서버 전달분을 기다리는 중이면 부르지 않는다', () => {
        expect(commentLikerIdsToFetch({ ...base, previewPending: true })).toEqual([]);
    });

    it('추천이 있는 댓글을 부른다', () => {
        expect(commentLikerIdsToFetch(base)).toEqual(['1', '3']);
    });

    it('서버 전달분으로 이미 채운 댓글은 뺀다 — 거기 없는 댓글만 부른다', () => {
        expect(commentLikerIdsToFetch({ ...base, loaded: new Set(['1']) })).toEqual(['3']);
    });

    it('요청 중이거나 재시도 한도를 넘긴 댓글은 뺀다', () => {
        expect(commentLikerIdsToFetch({ ...base, inflight: new Set(['3']) })).toEqual(['1']);
        expect(commentLikerIdsToFetch({ ...base, attempts: new Map([['1', 4]]) })).toEqual(['3']);
    });
});
