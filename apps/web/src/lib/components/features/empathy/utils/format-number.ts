/**
 * 숫자 포맷팅 (k/m/b) - PHP 원본 로직
 * @param num 원본 숫자
 * @returns 포맷팅된 문자열
 */
export function formatNumber(num: number): string {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'b';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'm';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    } else {
        return num.toString();
    }
}
