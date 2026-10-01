import { describe, expect, it } from 'vitest';
import { resolveTrustedHasPoll, shouldFetchPoll } from '../lib/poll-fetch-gate';

const base = { boardId: 'free', postId: 100, dataBoardId: 'free', dataPostId: 100 };

describe('resolveTrustedHasPoll', () => {
    it('짝이 맞으면 로더 값을 그대로', () => {
        expect(resolveTrustedHasPoll({ ...base, hasPoll: false })).toBe(false);
        expect(resolveTrustedHasPoll({ ...base, hasPoll: true })).toBe(true);
    });

    it('post.id 가 문자열이어도 숫자로 맞춰 비교', () => {
        expect(resolveTrustedHasPoll({ ...base, dataPostId: '100', hasPoll: false })).toBe(false);
    });

    it('postId 불일치(SPA 이동 순간 이전 글 값) → null', () => {
        expect(resolveTrustedHasPoll({ ...base, dataPostId: 99, hasPoll: false })).toBeNull();
    });

    it('boardId 불일치(보드별 wr_id 시퀀스라 같은 번호 가능) → null', () => {
        expect(resolveTrustedHasPoll({ ...base, dataBoardId: 'qa', hasPoll: false })).toBeNull();
    });

    it('page.data 가 비어 있으면 null', () => {
        expect(
            resolveTrustedHasPoll({
                ...base,
                dataBoardId: undefined,
                dataPostId: undefined,
                hasPoll: undefined
            })
        ).toBeNull();
    });

    it('null/undefined/이상값 → null', () => {
        expect(resolveTrustedHasPoll({ ...base, hasPoll: null })).toBeNull();
        expect(resolveTrustedHasPoll({ ...base, hasPoll: undefined })).toBeNull();
        expect(resolveTrustedHasPoll({ ...base, hasPoll: 0 })).toBeNull();
    });
});

describe('shouldFetchPoll', () => {
    it('없음(false) + 비작성자 → 생략', () => {
        expect(shouldFetchPoll(false, false)).toBe(false);
    });

    it('없음(false) + 작성자 → 호출 (투표 만들기 노출)', () => {
        expect(shouldFetchPoll(false, true)).toBe(true);
    });

    it('모름(null) → 호출 (fail-open)', () => {
        expect(shouldFetchPoll(null, false)).toBe(true);
    });

    it('있음(true) → 호출', () => {
        expect(shouldFetchPoll(true, false)).toBe(true);
    });

    it('짝 불일치로 null 이 된 false 는 호출로 떨어진다', () => {
        const trusted = resolveTrustedHasPoll({ ...base, dataPostId: 99, hasPoll: false });
        expect(shouldFetchPoll(trusted, false)).toBe(true);
    });
});
