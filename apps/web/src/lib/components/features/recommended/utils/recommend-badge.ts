/**
 * 추천수 기반 배지 컬러 클래스 반환 (PHP rcmd-box step1-4 Tailwind 변환)
 * @param recommendCount 추천수
 * @returns Tailwind CSS 클래스 문자열
 */
export function getRecommendBadgeClass(recommendCount: number): string {
    if (recommendCount <= 15) {
        // step1: 파란색
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
    } else if (recommendCount <= 25) {
        // step2: 보라색
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200';
    } else if (recommendCount <= 50) {
        // step3: 핑크색
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200';
    } else {
        // step4: 빨간색
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
    }
}
