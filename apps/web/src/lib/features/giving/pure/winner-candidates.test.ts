import { describe, expect, it } from 'vitest';
import {
    filterWinnerCandidates,
    resolveWinnerInput,
    toWinnerCandidates,
    winnerCandidateLabel
} from './winner-candidates';

const list = toWinnerCandidates(
    [
        { mb_id: 'naver_8bd908be', nick: '사과나무' },
        { mb_id: 'google_94e70922', nick: 'Banana' },
        { mb_id: 'kakao_1234abcd', nick: '' },
        { mb_id: 'naver_8bd908be', nick: '중복' }
    ],
    []
);

describe('toWinnerCandidates', () => {
    it('중복·빈 값을 버린다', () => {
        expect(list.map((c) => c.mb_id)).toEqual([
            'naver_8bd908be',
            'google_94e70922',
            'kakao_1234abcd'
        ]);
    });

    it('후보 목록이 없으면 참가자 ID 로 대체한다', () => {
        expect(toWinnerCandidates(undefined, ['a', '', 'a', 'b'])).toEqual([
            { mb_id: 'a', nick: '' },
            { mb_id: 'b', nick: '' }
        ]);
    });
});

describe('winnerCandidateLabel', () => {
    it('닉네임 (ID) 형식', () => {
        expect(winnerCandidateLabel(list[0])).toBe('사과나무 (naver_8bd908be)');
    });

    it('닉네임이 없으면 ID 만', () => {
        expect(winnerCandidateLabel(list[2])).toBe('kakao_1234abcd');
    });
});

describe('filterWinnerCandidates', () => {
    it('빈 입력이면 전체', () => {
        expect(filterWinnerCandidates(list, '  ')).toHaveLength(3);
    });

    it('닉네임 일부로 거른다', () => {
        expect(filterWinnerCandidates(list, '사과').map((c) => c.mb_id)).toEqual([
            'naver_8bd908be'
        ]);
    });

    it('ID 일부로 거른다(대소문자 무시)', () => {
        expect(filterWinnerCandidates(list, 'GOOGLE').map((c) => c.mb_id)).toEqual([
            'google_94e70922'
        ]);
        expect(filterWinnerCandidates(list, 'banana').map((c) => c.mb_id)).toEqual([
            'google_94e70922'
        ]);
    });

    it('이미 고른 후보의 라벨과 정확히 같으면 전체를 보여준다', () => {
        expect(filterWinnerCandidates(list, '사과나무 (naver_8bd908be)')).toHaveLength(3);
    });

    it('ID 전체를 치면 그 한 명만', () => {
        expect(filterWinnerCandidates(list, 'naver_8bd908be')).toHaveLength(1);
    });

    it('일치 없음', () => {
        expect(filterWinnerCandidates(list, '없는사람')).toEqual([]);
    });
});

describe('resolveWinnerInput', () => {
    it('라벨·ID·닉네임은 mb_id 로 바뀐다', () => {
        expect(resolveWinnerInput(list, '사과나무 (naver_8bd908be)')).toBe('naver_8bd908be');
        expect(resolveWinnerInput(list, ' google_94e70922 ')).toBe('google_94e70922');
        expect(resolveWinnerInput(list, 'Banana')).toBe('google_94e70922');
    });

    it('후보에 없는 값은 그대로(수동 입력)', () => {
        expect(resolveWinnerInput(list, 'someone_else')).toBe('someone_else');
        expect(resolveWinnerInput(list, '   ')).toBe('');
    });

    it('같은 닉네임이 둘이면 바꾸지 않는다', () => {
        const dup = toWinnerCandidates(
            [
                { mb_id: 'a', nick: '같은닉' },
                { mb_id: 'b', nick: '같은닉' }
            ],
            []
        );
        expect(resolveWinnerInput(dup, '같은닉')).toBe('같은닉');
    });
});
