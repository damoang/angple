import { describe, it, expect } from 'vitest';
import {
    SUGGEST_MIN_LEVEL,
    PROMOTE_THRESHOLD,
    DAILY_SUGGEST_LIMIT,
    isSuggestableBoard,
    shouldPromote,
    remainingToPromote,
    buildSuggestStatusText
} from './angtt-suggest-logic';
import { RATING_MIN_LEVEL } from './post-rating-logic';

describe('상수 — 스펙 값과 단일 소스 유지', () => {
    it('제안 최소 등급은 별점 기준(RATING_MIN_LEVEL)을 재사용한다', () => {
        expect(SUGGEST_MIN_LEVEL).toBe(RATING_MIN_LEVEL);
        expect(SUGGEST_MIN_LEVEL).toBe(3);
    });

    it('승격 임계는 서로 다른 회원 2명', () => {
        expect(PROMOTE_THRESHOLD).toBe(2);
    });

    it('레이트리밋은 회원당 일 10건', () => {
        expect(DAILY_SUGGEST_LIMIT).toBe(10);
    });
});

describe('isSuggestableBoard — free/angtt 한정', () => {
    it('free, angtt 는 허용', () => {
        expect(isSuggestableBoard('free')).toBe(true);
        expect(isSuggestableBoard('angtt')).toBe(true);
    });

    it('그 외 게시판은 거부', () => {
        expect(isSuggestableBoard('hello')).toBe(false);
        expect(isSuggestableBoard('bug')).toBe(false);
        expect(isSuggestableBoard('')).toBe(false);
        expect(isSuggestableBoard('FREE')).toBe(false); // 대소문자 정확 일치만
    });
});

describe('shouldPromote — 서로 다른 회원 수 임계 판정', () => {
    it('임계 미만이면 승격하지 않는다', () => {
        expect(shouldPromote(0)).toBe(false);
        expect(shouldPromote(1)).toBe(false);
    });

    it('임계 이상이면 승격한다', () => {
        expect(shouldPromote(2)).toBe(true);
        expect(shouldPromote(3)).toBe(true);
    });

    it('NaN/Infinity 는 승격하지 않는다', () => {
        expect(shouldPromote(NaN)).toBe(false);
        expect(shouldPromote(Infinity)).toBe(false);
    });
});

describe('remainingToPromote — 승격까지 남은 인원', () => {
    it('0명이면 임계 전원이 남는다', () => {
        expect(remainingToPromote(0)).toBe(PROMOTE_THRESHOLD);
    });

    it('1명이면 1명 남는다', () => {
        expect(remainingToPromote(1)).toBe(1);
    });

    it('임계 도달·초과 시 0 (음수 없음)', () => {
        expect(remainingToPromote(2)).toBe(0);
        expect(remainingToPromote(5)).toBe(0);
    });

    it('비정상 입력은 0명 취급', () => {
        expect(remainingToPromote(NaN)).toBe(PROMOTE_THRESHOLD);
        expect(remainingToPromote(-3)).toBe(PROMOTE_THRESHOLD);
    });
});

describe('buildSuggestStatusText — 카드 상태 문구', () => {
    it('승격 전에는 남은 인원을 함께 안내한다', () => {
        expect(buildSuggestStatusText(1)).toBe('1명이 제안했어요 (승격까지 1명)');
    });

    it('승격 도달 후에는 남은 인원 문구를 생략한다', () => {
        expect(buildSuggestStatusText(2)).toBe('2명이 제안했어요');
        expect(buildSuggestStatusText(3)).toBe('3명이 제안했어요');
    });
});
