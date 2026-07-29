import { describe, it, expect } from 'vitest';
import {
    levelExp,
    calculateLevelFromExp,
    calculateLevelInfo,
    MAX_XP_LEVEL
} from './level-thresholds';

/**
 * 이 테스트의 목적은 "웹 계산이 백엔드와 같은가" 하나다.
 *
 * 정본: backend internal/repository/v2/exp_repo.go
 *   levelExp(n) = 1000 × (n-1)²,  maxLevel 5000,  이진탐색
 *   progress    = ((x × 200 / range) + 1) / 2   (정수 나눗셈)
 *
 * 2026-07-29 bug/13149 — 웹이 109개짜리 계단식 표를 쓰고 백엔드는 2차식을 써서
 * 같은 회원이 화면마다 다른 레벨로 보였다. 두 곡선이 다시 갈라지면 이 테스트가 깨진다.
 */

/** 백엔드 Go 를 그대로 옮긴 참조 구현 (정수 나눗셈 포함). */
function goCalculateLevelInfo(totalExp: number): { level: number; progress: number } {
    const lvlExp = (l: number) => (l <= 1 ? 0 : 1000 * (l - 1) * (l - 1));
    let lo = 1;
    let hi = 5000;
    while (lo < hi) {
        const mid = Math.trunc((lo + hi + 1) / 2);
        if (lvlExp(mid) <= totalExp) lo = mid;
        else hi = mid - 1;
    }
    const level = lo;
    if (level >= 5000) return { level, progress: 100 };
    const next = lvlExp(level + 1);
    const prev = lvlExp(level);
    const range = next - prev;
    const progress =
        range > 0 ? Math.trunc((Math.trunc(((totalExp - prev) * 200) / range) + 1) / 2) : 0;
    return { level, progress };
}

describe('levelExp — 백엔드 공식', () => {
    it('레벨 1은 0', () => expect(levelExp(1)).toBe(0));
    it('0 이하도 0', () => expect(levelExp(0)).toBe(0));
    it('알려진 값', () => {
        expect(levelExp(2)).toBe(1000);
        expect(levelExp(3)).toBe(4000);
        expect(levelExp(10)).toBe(81000);
        expect(levelExp(40)).toBe(1521000);
    });
});

describe('calculateLevelFromExp — 경계값', () => {
    it.each([
        [0, 1],
        [1, 1],
        [999, 1],
        [1000, 2], // 딱 경계
        [3999, 2],
        [4000, 3], // 딱 경계
        [81000, 10],
        // bug/13149 제보 회원. 예전 109표로는 34 가 나왔다.
        [592363, 25]
    ])('exp %i → Lv.%i', (exp, expected) => {
        expect(calculateLevelFromExp(exp)).toBe(expected);
    });

    it('음수는 레벨 1', () => expect(calculateLevelFromExp(-1)).toBe(1));

    it('상한을 넘지 않는다', () => {
        expect(calculateLevelFromExp(Number.MAX_SAFE_INTEGER)).toBe(MAX_XP_LEVEL);
    });
});

describe('백엔드와 완전 일치 (level + progress)', () => {
    const samples = [
        0, 1, 999, 1000, 3000, 4000, 50000, 81000, 300000, 592363, 1000000, 1521000, 3116632,
        9000000, 11664000, 20000000
    ];

    it.each(samples)('exp %i', (exp) => {
        const web = calculateLevelInfo(exp);
        const go = goCalculateLevelInfo(exp);
        expect(web.level).toBe(go.level);
        expect(web.progress).toBe(go.progress);
    });

    it('무작위 20,000건에서도 일치', () => {
        // 시드 없는 난수 대신 결정적 시퀀스 — 실패 재현이 가능해야 한다.
        let seed = 12345;
        const next = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let i = 0; i < 20000; i++) {
            const exp = next() % 20000000;
            const web = calculateLevelInfo(exp);
            const go = goCalculateLevelInfo(exp);
            expect(web.level, `exp=${exp}`).toBe(go.level);
            expect(web.progress, `exp=${exp}`).toBe(go.progress);
        }
    });
});

describe('calculateLevelInfo — 진행도', () => {
    it('레벨 시작점은 0%', () => expect(calculateLevelInfo(1000).progress).toBe(0));
    it('다음 레벨 직전은 100% 미만', () => {
        const info = calculateLevelInfo(3999);
        expect(info.progress).toBeLessThan(100);
        expect(info.expToNext).toBe(1);
    });
    it('expToNext 는 음수가 되지 않는다', () => {
        expect(calculateLevelInfo(0).expToNext).toBeGreaterThanOrEqual(0);
    });
});
