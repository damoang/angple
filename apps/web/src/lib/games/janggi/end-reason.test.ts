/**
 * 끝 이유 → 문구 매핑 (온라인 6종 + 로컬 궁 잡음·둘 수 없음)
 */
import { describe, it, expect } from 'vitest';
import { TEAM } from './rules';
import { endText, endTextForTeam, isEndReason, isScoreReason, scoreText } from './end-reason';

describe('endText — 내 시점 배너', () => {
    const cases: Array<[string, string, string]> = [
        ['checkmate', '외통! 🎉 승리', '외통… 패배'],
        ['resign', '기권승', '기권패'],
        ['timeout', '시간승', '시간패'],
        ['disconnect', '상대 이탈승', '이탈패'],
        ['bikjang_score', '빅장 판정승', '빅장 판정패'],
        ['stall_score', '교착 판정승', '교착 판정패']
    ];

    for (const [reason, win, lose] of cases) {
        it(`${reason}: 승 「${win}」 / 패 「${lose}」`, () => {
            expect(endText(reason, true).banner).toBe(win);
            expect(endText(reason, false).banner).toBe(lose);
            expect(endText(reason, true).tone).toBe('win');
            expect(endText(reason, false).tone).toBe('lose');
        });
    }

    it('결과 상자: 이유 · 수', () => {
        expect(endText('checkmate', true, { moves: 42 }).detail).toBe('외통으로 승리 · 42수');
        expect(endText('checkmate', false, { moves: 17 }).detail).toBe('외통으로 패배 · 17수');
        expect(endText('resign', true, { moves: 8 }).detail).toBe('상대 기권으로 승리 · 8수');
        expect(endText('timeout', false).detail).toBe('시간 초과로 패배');
        expect(endText('disconnect', true).detail).toBe('상대가 대국을 떠나 승리');
    });

    it('수를 모르면(재접속) 수 표기를 뺀다', () => {
        expect(endText('checkmate', true, { moves: null }).detail).toBe('외통으로 승리');
        expect(endText('checkmate', true, { moves: 0 }).detail).toBe('외통으로 승리');
    });

    it('점수 판정은 점수를 붙인다(덤 포함, 소수 한 자리)', () => {
        const scores = { cho: 30, han: 31.5 };
        expect(endText('bikjang_score', false, { moves: 60, scores }).detail).toBe(
            '빅장 점수 판정으로 패배 · 60수 · 초 30점 · 한 31.5점(덤 포함)'
        );
        expect(endText('stall_score', true, { scores }).detail).toBe(
            '교착 점수 판정으로 승리 · 초 30점 · 한 31.5점(덤 포함)'
        );
        // 점수 판정이 아니면 점수를 안 붙인다
        expect(endText('resign', true, { scores }).detail).toBe('상대 기권으로 승리');
    });

    it('로컬: 궁을 잡은 끝은 외통과 다른 문구', () => {
        expect(endText('king_captured', true).banner).toBe('궁을 잡았습니다! 🎉 승리');
        expect(endText('king_captured', false).detail).toBe('궁을 잡혀 패배');
        expect(endText('king_captured', true).banner).not.toContain('외통');
    });

    it('알 수 없는 이유는 승/패만', () => {
        expect(endText('', true).banner).toBe('🎉 승리');
        expect(endText('draw', false).banner).toBe('패배');
        expect(endText('weird', false, { moves: 3 }).detail).toBe('패배 · 3수');
    });
});

describe('endTextForTeam — 2인 한 화면', () => {
    it('이긴 진영 이름으로', () => {
        const t = endTextForTeam('checkmate', TEAM.HAN, { moves: 31 });
        expect(t.banner).toBe('외통! 한(漢) 승리');
        expect(t.detail).toBe('외통으로 한(漢) 승리 · 31수');
        expect(t.tone).toBe('neutral');
        expect(endTextForTeam('king_captured', TEAM.CHO).banner).toBe('초(楚) 궁 잡고 승리');
    });
});

describe('보조', () => {
    it('isEndReason·isScoreReason·scoreText', () => {
        expect(isEndReason('checkmate')).toBe(true);
        expect(isEndReason('draw')).toBe(false);
        expect(isEndReason('toString')).toBe(false);
        expect(isScoreReason('bikjang_score')).toBe(true);
        expect(isScoreReason('checkmate')).toBe(false);
        expect(scoreText({ cho: 72, han: 73.5 })).toBe('초 72점 · 한 73.5점(덤 포함)');
    });
});
