/**
 * 추천수 기반 배지 컬러 클래스 반환 (레거시 rcmd-box step0-4 일치)
 * step0: 0건, step1: 1-5, step2: 6-10, step3: 11-50, step4: 51+
 * @param recommendCount 추천수
 * @returns Tailwind CSS 클래스 문자열
 */
export function getRecommendBadgeClass(recommendCount: number): string {
    if (recommendCount === 0) {
        // step0: 거의 투명 bg, 20% 텍스트
        return 'bg-[rgba(172,172,172,0.04)] text-foreground/20';
    } else if (recommendCount <= 5) {
        // step1: 회색 계열
        return 'bg-[rgba(172,172,172,0.2)] text-foreground';
    } else if (recommendCount <= 10) {
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

/**
 * 추천수 기반 인라인 스타일 반환 (레거시 rcmd-box step0-4 정확히 일치)
 * Tailwind 클래스가 적용되지 않는 경우 대체용
 */
export function getRecommendBadgeStyle(recommendCount: number): string {
    if (recommendCount === 0) {
        return 'background:color-mix(in oklch, var(--foreground) 4%, transparent);color:color-mix(in oklch, var(--foreground) 20%, transparent);';
    } else if (recommendCount <= 5) {
        return 'background:rgba(172,172,172,0.2);color:var(--color-foreground);';
    } else if (recommendCount <= 10) {
        return 'background:rgba(59,130,246,0.3);color:var(--color-foreground);';
    } else if (recommendCount <= 50) {
        return 'background:rgba(59,130,246,0.6);color:var(--color-foreground);';
    } else {
        return 'background:rgba(0,102,255,0.75);color:#fff;';
    }
}
