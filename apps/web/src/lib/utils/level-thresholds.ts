/**
 * XP 레벨 임계값 + 레벨 계산 유틸 (server·client 공통)
 *
 * 단일 source of truth. 기존 다음 위치들에서 중복 정의돼 있던 것을 모음:
 * - apps/web/src/routes/api/members/[id]/profile/+server.ts (계산 사용)
 * - apps/web/src/lib/server/member-levels.ts (저장값 그대로 반환 — drift 발생)
 * - angple-backend / damoang-backend 의 별도 구현
 *
 * #12046 — 헤더의 LevelBadge 가 stale 한 DB as_level 을 보여 프로필 동적 계산값과
 * 불일치하던 문제를 fix 하기 위해 동일 임계값으로 항상 계산하도록 통일.
 */

/**
 * 누적 XP 임계값 — index 0 부터 시작하며 currentLevel = (조건 만족하는 최대 index) + 1.
 * 예: as_exp=3,116,632 → idx 63 (3,003,000) 통과, idx 64 (3,146,000) 미통과 → level 64
 */
export const LEVEL_THRESHOLDS: readonly number[] = [
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000,
    105000, 120000, 136000, 153000, 171000, 190000, 210000, 231000, 253000, 276000, 300000, 325000,
    351000, 378000, 406000, 435000, 466000, 499000, 534000, 571000, 610000, 651000, 694000, 739000,
    786000, 835000, 887000, 941000, 998000, 1058000, 1121000, 1187000, 1256000, 1328000, 1403000,
    1481000, 1563000, 1649000, 1739000, 1833000, 1931000, 2033000, 2139000, 2249000, 2363000,
    2481000, 2604000, 2732000, 2865000, 3003000, 3146000, 3294000, 3447000, 3605000, 3768000,
    3936000, 4110000, 4290000, 4476000, 4668000, 4866000, 5070000, 5280000, 5496000, 5718000,
    5946000, 6181000, 6423000, 6672000, 6928000, 7191000, 7461000, 7738000, 8022000, 8313000,
    8611000, 8917000, 9231000, 9553000, 9883000, 10221000, 10567000, 10921000, 11283000, 11653000,
    12031000, 12418000, 12814000, 13219000, 13633000, 14056000, 14488000, 14929000, 15379000,
    15838000
];

export interface LevelInfo {
    level: number;
    nextLevelExp: number;
    expToNext: number;
    progress: number;
}

/**
 * 누적 XP 로부터 현재 레벨을 계산 (DB 저장 as_level 무시 — exp 가 진실의 원천)
 * @param totalExp 누적 as_exp
 * @returns currentLevel (1 부터 시작)
 */
export function calculateLevelFromExp(totalExp: number): number {
    let currentLevel = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (totalExp >= LEVEL_THRESHOLDS[i]) {
            currentLevel = i + 1;
        } else {
            break;
        }
    }
    return currentLevel;
}

/**
 * 누적 XP 로부터 레벨 + 진행도 정보 반환
 */
export function calculateLevelInfo(totalExp: number): LevelInfo {
    const level = calculateLevelFromExp(totalExp);

    if (level >= LEVEL_THRESHOLDS.length) {
        return {
            level,
            nextLevelExp: LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1],
            expToNext: 0,
            progress: 100
        };
    }

    const nextLevelExp = LEVEL_THRESHOLDS[level];
    const prevLevelExp = level > 1 ? LEVEL_THRESHOLDS[level - 1] : 0;
    const expToNext = Math.max(0, nextLevelExp - totalExp);
    const range = nextLevelExp - prevLevelExp;
    const progress = range > 0 ? Math.round(((totalExp - prevLevelExp) * 100) / range) : 0;

    return { level, nextLevelExp, expToNext, progress };
}
