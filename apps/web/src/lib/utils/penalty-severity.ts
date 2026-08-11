/**
 * 이용제한 강도(severity)의 단일 정의.
 *
 * 목록(`/disciplinelog`)과 상세(`/disciplinelog/[id]`)가 각자 색을 정하던 탓에
 * 같은 기록이 화면마다 다른 심각도로 보였다 — 목록에서 빨간 점으로 본 영구 제재가
 * 상세에서는 기간제와 똑같은 기본 배지로 나왔다. 두 화면이 이 파일 하나만
 * 바라보게 해서 색 언어가 갈라질 수 없게 한다.
 *
 * ⛔ 소명 인용 해제(revoked)는 기간 만료(released)와 원인은 다르지만
 *    "지금 효력이 없다"는 점에서 같다. 강도 표기는 released 로 합치고,
 *    구분은 별도의 초록 배지가 맡는다(강도 축에 섞지 않는다).
 */

/** 이용제한의 심각도. 색·강조는 전부 이 값에서 파생된다. */
export type PenaltySeverity = 'permanent' | 'active' | 'notice' | 'released';

/**
 * 제재 일수와 해제 여부로 강도를 판정한다.
 *
 * @param period 제재 일수. -1 = 영구, 0 = 주의, 1 이상 = 기간제
 * @param released 기간 만료 여부 (`getPenaltyDisplay().released`)
 * @param revoked 소명 인용 해제 여부
 */
export function penaltySeverity(
    period: number,
    released: boolean = false,
    revoked: boolean = false
): PenaltySeverity {
    if (released || revoked) return 'released';
    if (period === -1) return 'permanent';
    if (period === 0) return 'notice';
    return 'active';
}

/** 목록 왼쪽 강도 점의 배경색 */
export const SEVERITY_DOT: Record<PenaltySeverity, string> = {
    permanent: 'bg-red-500',
    active: 'bg-amber-500',
    notice: 'bg-muted-foreground/60',
    released: 'bg-muted-foreground/40'
};

/** 강도를 나타내는 짧은 텍스트("영구"·"5일"·"주의")의 색 */
export const SEVERITY_TEXT: Record<PenaltySeverity, string> = {
    permanent: 'text-red-600 dark:text-red-400',
    active: 'text-amber-700 dark:text-amber-500',
    notice: 'text-muted-foreground',
    released: 'text-muted-foreground'
};

/**
 * 상세 페이지 배지의 색.
 *
 * shadcn `variant` 로는 주황(기간제)을 표현할 수 없어 클래스로 통일한다.
 * 목록의 텍스트 색과 같은 계열을 써서 목록 → 상세 이동 시 인상이 이어지게 한다.
 */
export const SEVERITY_BADGE: Record<PenaltySeverity, string> = {
    permanent:
        'border-red-300 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    active: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    notice: 'border-border bg-muted text-muted-foreground',
    released: 'border-border bg-muted text-muted-foreground'
};
