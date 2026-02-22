/**
 * 추천수 기반 배지 컬러 클래스 반환 (현세대 rcmd-box step0-4 일치)
 * @param recommendCount 추천수
 * @returns Tailwind CSS 클래스 문자열
 */
export function getRecommendBadgeClass(recommendCount: number): string {
    if (recommendCount === 0) {
        // step0: 추천 0건 - 매우 연한 배경
        return 'bg-[rgba(172,172,172,0.08)] text-foreground/20';
    } else if (recommendCount <= 15) {
        // step1: 회색 계열
        return 'bg-[rgba(172,172,172,0.2)] text-foreground';
    } else if (recommendCount <= 25) {
        // step2: 연한 파란색
        return 'bg-[rgba(59,130,246,0.3)] text-foreground';
    } else if (recommendCount <= 50) {
        // step3: 중간 파란색
        return 'bg-[rgba(59,130,246,0.6)] text-foreground';
    } else {
        // step4: 진한 파란색 + 흰 글자
        return 'bg-[rgba(0,102,255,0.75)] text-white';
    }
}
