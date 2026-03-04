/**
 * 숫자 축약 포맷 (유튜브 스타일)
 * 1000 → 1k, 1200 → 1.2k, 15400 → 1.5만, 1000000 → 100만
 *
 * @param num 원본 숫자
 * @returns 포맷팅된 문자열
 */
export function formatCompactNumber(num: number): string {
    if (num >= 100_000_000) {
        return (num / 100_000_000).toFixed(1).replace(/\.0$/, '') + '억';
    } else if (num >= 10_000) {
        return (num / 10_000).toFixed(1).replace(/\.0$/, '') + '만';
    } else if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}
