/**
 * 날짜 포맷 유틸리티 (서울 시간 기준)
 * - 오늘: HH:MM (예: 14:30)
 * - 어제: 어제 HH:MM
 * - 올해: MM.DD (예: 02.19)
 * - 작년 이전: YY.MM.DD (예: 25.02.19)
 */

type DateInput = string | number | null | undefined;

/**
 * 다양한 형태의 입력을 Date 가 안전하게 파싱할 수 있는 문자열로 정규화한다.
 * - YYYYMMDD (Gnuboard 8자리)
 * - 10자리 Unix timestamp (초 단위) — Sphinx/검색 응답이 숫자로 내려올 수 있어, 밀리초로 변환하지 않으면 1970년 또는 미래 날짜로 잘못 표시됨 (#12266)
 * - 그 외는 원본 문자열 그대로 (ISO/RFC 형식 가정)
 */
function normalizeDateInput(input: DateInput): string {
    if (input === null || input === undefined || input === '') return '';
    const str = String(input);
    if (/^\d{10}$/.test(str)) {
        const seconds = Number(str);
        if (Number.isFinite(seconds)) {
            return new Date(seconds * 1000).toISOString();
        }
    }
    if (/^\d{8}$/.test(str)) {
        return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    return str;
}

/**
 * 목록용 날짜 포맷 (MM.DD HH:MM 통일)
 * 행 높이가 일정하게 유지됨
 */
export function formatDateCompact(dateString: DateInput): string {
    const normalized = normalizeDateInput(dateString);
    if (!normalized) return '';
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    const now = new Date();

    const toSeoulDateStr = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const dateStr = toSeoulDateStr(date);
    const nowStr = toSeoulDateStr(now);

    if (dateStr === nowStr) {
        // 오늘: HH:MM
        return date.toLocaleTimeString('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } else if (dateStr.slice(0, 4) === nowStr.slice(0, 4)) {
        // 올해: MM.DD
        return `${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    } else {
        // 작년 이전: YY.MM.DD
        return `${dateStr.slice(2, 4)}.${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    }
}
/**
 * 주어진 날짜가 오늘(서울 시간 기준)인지 확인
 */
export function isToday(dateString: DateInput): boolean {
    const normalized = normalizeDateInput(dateString);
    if (!normalized) return false;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    const toSeoulDateStr = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    return toSeoulDateStr(date) === toSeoulDateStr(now);
}

export function formatDate(dateString: DateInput): string {
    // 빈 값/무효 입력은 빈 문자열 반환. 과거 Invalid Date → toLocaleTimeString 이
    // "Invalid Date" (production minify 시 "va.id.Da" 등)로 노출되던 문제 방지.
    const normalized = normalizeDateInput(dateString);
    if (!normalized) return '';
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
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
        // 어제: MM.DD (목록 2줄 방지)
        return `${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    } else if (dateStr.slice(0, 4) === nowStr.slice(0, 4)) {
        // 올해: MM.DD
        return `${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    } else {
        // 작년 이전: YY.MM.DD
        return `${dateStr.slice(2, 4)}.${dateStr.slice(5, 7)}.${dateStr.slice(8, 10)}`;
    }
}
