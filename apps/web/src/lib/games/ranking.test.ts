/**
 * 온라인 대전 랭킹 카드 — 응답 정리·내 순위 한 줄·제목 숫자
 */
import { describe, it, expect } from 'vitest';
import {
    RANKING_MAX,
    findMyIndex,
    myRankLine,
    rankingTitleCount,
    toRankingRows,
    type RankingRow
} from './ranking';

function rows(n: number): RankingRow[] {
    return Array.from({ length: n }, (_, i) => ({
        nickname: `앙님${i + 1}`,
        wins: 10 - (i % 10),
        losses: i % 3,
        draws: i % 2,
        rating: 1600 - i * 10
    }));
}

describe('toRankingRows', () => {
    it('정상 응답을 숫자·문자열로 정리한다', () => {
        const out = toRankingRows({
            ranking: [{ nickname: ' 철수 ', wins: '3', losses: 1, draws: 0, rating: 1520 }]
        });
        expect(out).toEqual([{ nickname: '철수', wins: 3, losses: 1, draws: 0, rating: 1520 }]);
    });

    it('모양이 이상하면 빈 배열', () => {
        expect(toRankingRows(null)).toEqual([]);
        expect(toRankingRows({})).toEqual([]);
        expect(toRankingRows({ ranking: 'x' })).toEqual([]);
        expect(toRankingRows({ ranking: null })).toEqual([]);
    });

    it('닉네임 없는 줄·null 줄은 버리고 숫자가 아니면 0', () => {
        const out = toRankingRows({
            ranking: [null, { nickname: '' }, { nickname: '영희', wins: 'abc' }]
        });
        expect(out).toEqual([{ nickname: '영희', wins: 0, losses: 0, draws: 0, rating: 0 }]);
    });

    it('최대 20줄', () => {
        expect(toRankingRows({ ranking: rows(30) })).toHaveLength(RANKING_MAX);
    });
});

describe('내 순위 한 줄', () => {
    it('비로그인이면 로그인 안내', () => {
        expect(myRankLine(rows(5), '')).toContain('로그인');
        expect(findMyIndex(rows(5), '')).toBe(-1);
    });

    it('목록에 있으면 순위·전적·점수', () => {
        const list = rows(5);
        expect(findMyIndex(list, '앙님3')).toBe(2);
        expect(myRankLine(list, '앙님3')).toBe(
            `내 순위 3위 · ${list[2].wins}승 ${list[2].losses}패 ${list[2].draws}무 · ${list[2].rating}점`
        );
    });

    it('20명 꽉 찬 목록에 없으면 TOP 20 밖', () => {
        expect(myRankLine(rows(20), '없는사람')).toContain('TOP 20 밖');
    });

    it('목록이 덜 찼는데 없으면 아직 순위에 없음', () => {
        expect(myRankLine(rows(4), '없는사람')).toContain('아직 순위에 없어요');
    });
});

describe('제목 TOP 숫자', () => {
    it('접힌 상태는 최대 10, 줄이 적으면 그 수', () => {
        expect(rankingTitleCount(rows(20), false)).toBe(10);
        expect(rankingTitleCount(rows(3), false)).toBe(3);
    });

    it('펼친 상태는 전체 줄 수', () => {
        expect(rankingTitleCount(rows(20), true)).toBe(20);
    });
});
