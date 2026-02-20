/**
 * 날짜 포맷 유틸리티 (서울 시간 기준)
 * - 오늘: HH:MM (예: 14:30)
 * - 어제: 어제
 * - 올해: MM.DD (예: 02.19)
 * - 작년 이전: YY.MM.DD (예: 25.02.19)
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();

    // 서울 시간 기준 YYYY-MM-DD 문자열 추출
    const toSeoulDateStr = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // "2026-02-20"

    const dateStr = toSeoulDateStr(date);
    const nowStr = toSeoulDateStr(now);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = toSeoulDateStr(yesterday);

    if (dateStr === nowStr) {
        // 오늘: HH:MM
        return date.toLocaleTimeString('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } else if (dateStr === yesterdayStr) {
        return '어제';
    } else if (dateStr.slice(0, 4) === nowStr.slice(0, 4)) {
        // 올해: MM.DD
        return `${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    } else {
        // 작년 이전: YY.MM.DD
        return `${dateStr.slice(2, 4)}.${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    }
}
