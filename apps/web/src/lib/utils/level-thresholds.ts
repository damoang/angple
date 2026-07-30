/**
 * XP 레벨 계산 유틸 (server·client 공통) — 단일 source of truth.
 *
 * 기존 다음 위치들에서 중복 정의돼 있던 것을 모음:
 * - apps/web/src/routes/api/members/[id]/profile/+server.ts (계산 사용)
 * - apps/web/src/lib/server/member-levels.ts (저장값 그대로 반환 — drift 발생)
 * - angple-backend / damoang-backend 의 별도 구현
 *
 * #12046 — 헤더의 LevelBadge 가 stale 한 DB as_level 을 보여 프로필 동적 계산값과
 * 불일치하던 문제를 fix 하기 위해 동일 임계값으로 항상 계산하도록 통일.
 *
 * ---------------------------------------------------------------------------
 * 2026-07-29 (bug/13149) — 곡선을 백엔드와 같은 것으로 교체.
 *
 * 그동안 이 파일은 109개짜리 계단식 임계값 표를 들고 있었는데, **백엔드가 쓰는
 * 곡선과 다른 곡선이었다.** 백엔드는 `1000·(n−1)²` 로 as_level 을 저장하고 조회도
 * 같은 공식으로 하는데(exp_repo.go:111), 웹만 이 표로 계산하고 있었다.
 *
 *   as_exp 592,363  →  이 표: Lv.34   /   백엔드: Lv.25
 *
 * 두 곡선은 3번째 항목부터 갈라진다(표 3,000 vs 공식 4,000). 중간 구간은 공식이
 * 낮게 나오고, 표가 109 에서 잘리는 초고 XP 구간은 공식이 높게 나온다 — 그래서
 * 차이가 한 방향이 아니라 양쪽으로 갈렸다.
 *
 * 실측: as_exp 상위 3,000명 중 2,996명(99.9%)이 웹 표시값 ≠ 저장값. 최대 14레벨 차이.
 * 회원 눈에는 "프로필 들어가는 길에 따라 레벨이 다르게 보인다"로 나타났다.
 *
 * ⛔ 왜 표가 아니라 공식을 정본으로 골랐는가:
 *    표를 정본으로 삼으면 DB 의 as_level 을 전 회원 일괄 보정해야 하는데, 레벨이
 *    오르는 순간 xp-levelup-toast 가 발화해 **수천 명에게 동시에 축하 모달**이 뜬다
 *    (전환쌍 중복방지 키가 새 값이라 막지 못한다). 게다가 중고거래 글쓰기 권한이
 *    as_level >= 30 이라 경계가 대량 이동한다.
 *    공식을 백엔드에 맞추면 **DB 를 한 줄도 건드리지 않고** 표시만 일치한다.
 *
 * ⛔ 이 파일의 계산을 백엔드와 다르게 바꾸지 말 것.
 *    정본은 backend `internal/repository/v2/exp_repo.go` 의 levelExp / calculateLevelInfo 다.
 *    한쪽만 바꾸면 이 버그가 그대로 재발한다.
 */

/** 나리야 호환 XP 기준값 — 백엔드 exp_repo.go 의 xp_base. */
const XP_BASE = 1000;

/**
 * 도달 가능한 최대 레벨 (나리야 xp_max). 백엔드 exp_repo.go:106 과 같은 값.
 *
 * ⚠️ 배지 이미지는 109 까지만 있고(level-badge.svelte 의 MAX_LEVEL) 그 위는 클램프된다.
 *    레벨 109 = 1000 × 108² = 11,664,000 XP.
 */
export const MAX_XP_LEVEL = 5000;

/**
 * 해당 레벨에 도달하는 데 필요한 누적 XP.
 * 백엔드 `levelExp()` 와 동일: `XP_BASE × (level−1)²`
 *
 *   Lv.1 → 0 / Lv.2 → 1,000 / Lv.3 → 4,000 / Lv.10 → 81,000 / Lv.40 → 1,521,000
 */
export function levelExp(level: number): number {
    if (level <= 1) return 0;
    const n = level - 1;
    return XP_BASE * n * n;
}

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
    // 백엔드와 같은 이진탐색. levelExp(level) <= totalExp 를 만족하는 가장 높은 level.
    let lo = 1;
    let hi = MAX_XP_LEVEL;
    while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        if (levelExp(mid) <= totalExp) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return lo;
}

/**
 * 누적 XP 로부터 레벨 + 진행도 정보 반환.
 * progress 반올림까지 백엔드 calculateLevelInfo 와 같은 값이 나오도록 맞췄다.
 */
export function calculateLevelInfo(totalExp: number): LevelInfo {
    const level = calculateLevelFromExp(totalExp);

    if (level >= MAX_XP_LEVEL) {
        return {
            level,
            nextLevelExp: levelExp(level),
            expToNext: 0,
            progress: 100
        };
    }

    const nextLevelExp = levelExp(level + 1);
    const prevLevelExp = levelExp(level);
    const expToNext = Math.max(0, nextLevelExp - totalExp);
    const levelRange = nextLevelExp - prevLevelExp;
    // 백엔드와 동일한 정수 반올림 트릭: ((x * 200 / range) + 1) / 2
    const progress =
        levelRange > 0
            ? Math.floor((Math.floor(((totalExp - prevLevelExp) * 200) / levelRange) + 1) / 2)
            : 0;

    return { level, nextLevelExp, expToNext, progress };
}
