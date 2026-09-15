/**
 * 게시판별 글쓰기 안내 — 상수 및 localStorage 헬퍼 (bug-write-notice.ts 일반화).
 *
 * 관리자가 게시판 확장설정(write_notice)에 저장한 안내를, 글쓰기 진입 시 배너 또는
 * 인터스티셜로 보여준다. "오늘 하루 보지 않기"로 일정 시간(skipHours, 기본 24h) 동안
 * 게시판별로 생략할 수 있다.
 */

/** 게시판별 "오늘 하루 보지 않기" 저장 키 (값 = 마지막으로 건너뛴 시각, ms 타임스탬프). */
export function writeNoticeSkipKey(boardId: string): string {
    return `angple_write_notice_skip_ts_${boardId}`;
}

/** 기본 재노출 주기 — 24시간. */
export const WRITE_NOTICE_DEFAULT_SKIP_HOURS = 24;

/**
 * skipHours 내에 "오늘 하루 보지 않기"가 저장돼 있으면 true.
 * localStorage 접근 실패(프라이빗 모드 등) 시 false를 반환해 안내를 표시한다.
 */
export function isWriteNoticeSkipped(
    boardId: string,
    skipHours: number = WRITE_NOTICE_DEFAULT_SKIP_HOURS,
    now: number = Date.now()
): boolean {
    try {
        const raw = localStorage.getItem(writeNoticeSkipKey(boardId));
        if (!raw) return false;
        const ts = Number(raw);
        if (!Number.isFinite(ts)) return false;
        const windowMs = skipHours * 60 * 60 * 1000;
        return now - ts < windowMs;
    } catch {
        return false;
    }
}

/** "오늘 하루 보지 않기" 선택 시 현재 시각을 저장한다. 실패는 조용히 무시. */
export function setWriteNoticeSkip(boardId: string, now: number = Date.now()): void {
    try {
        localStorage.setItem(writeNoticeSkipKey(boardId), String(now));
    } catch {
        // 저장 실패는 무시 — 다음 진입에 안내가 다시 뜰 뿐이다
    }
}
