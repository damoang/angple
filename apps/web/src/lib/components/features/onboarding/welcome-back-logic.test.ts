import { describe, it, expect } from 'vitest';
import {
    cacheKey,
    dismissKey,
    isDormantWindow,
    isHoldout,
    lastContributionAt,
    parseKstDateTime,
    MIN_DORMANT_DAYS,
    MAX_DORMANT_DAYS
} from './welcome-back-logic';

describe('parseKstDateTime', () => {
    it('공백 구분 KST 문자열을 파싱한다 (Safari 호환 형식)', () => {
        expect(parseKstDateTime('2026-07-20 00:50:55')).toBe(
            Date.parse('2026-07-20T00:50:55+09:00')
        );
    });

    it('로컬 타임존과 무관하게 KST 로 해석한다', () => {
        // +09:00 을 명시하지 않으면 기기 타임존에 따라 최대 하루 가까이 흔들려 56일 임계가 깨진다
        const t = parseKstDateTime('2026-01-01 00:00:00');
        expect(new Date(t!).toISOString()).toBe('2025-12-31T15:00:00.000Z');
    });

    it('빈 값·형식 불일치는 null', () => {
        expect(parseKstDateTime(undefined)).toBeNull();
        expect(parseKstDateTime('')).toBeNull();
        expect(parseKstDateTime('어제')).toBeNull();
    });
});

describe('lastContributionAt', () => {
    it('글·댓글 중 가장 최신 시각을 고른다', () => {
        const got = lastContributionAt({
            recentPosts: [{ wr_datetime: '2026-05-01 10:00:00' }],
            recentComments: [{ wr_datetime: '2026-06-01 10:00:00' }]
        });
        expect(got).toBe(Date.parse('2026-06-01T10:00:00+09:00'));
    });

    it('빈 응답·null 은 null (판정 불가 → 미노출)', () => {
        expect(lastContributionAt(null)).toBeNull();
        expect(lastContributionAt({})).toBeNull();
        expect(lastContributionAt({ recentPosts: [], recentComments: [] })).toBeNull();
    });

    it('파싱 불가 항목은 건너뛰고 유효한 것만 본다', () => {
        const got = lastContributionAt({
            recentPosts: [{ wr_datetime: 'bad' }, { wr_datetime: '2026-03-03 09:00:00' }]
        });
        expect(got).toBe(Date.parse('2026-03-03T09:00:00+09:00'));
    });
});

describe('isDormantWindow', () => {
    it('8~25주만 대상 — 경계 포함', () => {
        expect(isDormantWindow(MIN_DORMANT_DAYS)).toBe(true);
        expect(isDormantWindow(MAX_DORMANT_DAYS)).toBe(true);
    });

    it('8주 미만은 아직 이탈이 아니다', () => {
        expect(isDormantWindow(MIN_DORMANT_DAYS - 1)).toBe(false);
        expect(isDormantWindow(0)).toBe(false);
    });

    it('26주 이상은 자연 복귀율 7% 이하 — 대상 제외', () => {
        expect(isDormantWindow(MAX_DORMANT_DAYS + 1)).toBe(false);
        expect(isDormantWindow(400)).toBe(false);
    });
});

describe('isHoldout', () => {
    it('같은 회원은 항상 같은 군 (결정적)', () => {
        const id = 'google_8c3a08951';
        expect(isHoldout(id)).toBe(isHoldout(id));
    });

    it('실제 mb_id 형식 표본에서 대략 10% 로 갈린다', () => {
        const prefixes = ['google_', 'naver_', 'kakao_', 'apple_'];
        const ids: string[] = [];
        for (const p of prefixes) {
            for (let i = 0; i < 5000; i++) ids.push(`${p}${(i * 2654435761).toString(16)}`);
        }
        const rate = ids.filter(isHoldout).length / ids.length;
        expect(rate).toBeGreaterThan(0.07);
        expect(rate).toBeLessThan(0.13);
    });
});

describe('localStorage 키 스코프', () => {
    it('회원별로 분리된다 — 공유 기기에서 남의 판정이 재사용되면 오노출된다', () => {
        expect(cacheKey('a')).not.toBe(cacheKey('b'));
        expect(dismissKey('a')).not.toBe(dismissKey('b'));
        expect(cacheKey('a')).toContain('a');
    });
});
