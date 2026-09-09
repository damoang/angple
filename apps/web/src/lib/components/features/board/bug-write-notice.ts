/**
 * 버그게시판 글쓰기 안내 인터스티셜 — 상수 및 localStorage 헬퍼.
 *
 * 버그게시판(board_id='bug')이 회원 신고 용도로 오용되는 것을 예방하기 위해,
 * 글쓰기 진입 시 "신고는 신고 버튼 / 질문은 질문게시판 / 버그는 양식대로" 안내를 1회 보여준다.
 * 안내는 "오늘 하루 보지 않기"로 24시간 동안 생략할 수 있다(버그게시판은 이용 빈도가 낮아
 * 영구 스킵보다 하루 단위 재노출이 적절).
 */

/** "오늘 하루 보지 않기" 저장 키 (값 = 마지막으로 건너뛴 시각, ms 타임스탬프). */
export const BUG_NOTICE_SKIP_KEY = 'angple_bug_write_notice_skip_ts';

/** 안내 재노출 주기 — 24시간. */
export const BUG_NOTICE_SKIP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 버그 제보 본문 기본 양식 (bug/3806 기준). create 진입 시 본문에 prefill 되며,
 * 관련 없는 항목은 지우고 사용하면 된다.
 */
export const BUG_TEMPLATE_CONTENT =
    '<p>ㅇ 사용기기: 모바일 / PC / 맥 / 기타</p>' +
    '<p>ㅇ 브라우저: 크롬 / 사파리 / 엣지 / 기타</p>' +
    '<p>(관련 없는 항목은 지우고 작성해 주세요)</p>' +
    '<p><br></p>';

/**
 * 24시간 내에 "오늘 하루 보지 않기"가 저장돼 있으면 true.
 * localStorage 접근 실패(프라이빗 모드 등) 시 false를 반환해 안내를 표시한다.
 */
export function isBugNoticeSkipped(now: number = Date.now()): boolean {
    try {
        const raw = localStorage.getItem(BUG_NOTICE_SKIP_KEY);
        if (!raw) return false;
        const ts = Number(raw);
        if (!Number.isFinite(ts)) return false;
        return now - ts < BUG_NOTICE_SKIP_WINDOW_MS;
    } catch {
        return false;
    }
}

/** "오늘 하루 보지 않기" 선택 시 현재 시각을 저장한다. 실패는 조용히 무시. */
export function setBugNoticeSkip(now: number = Date.now()): void {
    try {
        localStorage.setItem(BUG_NOTICE_SKIP_KEY, String(now));
    } catch {
        // 저장 실패는 무시 — 다음 진입에 안내가 다시 뜰 뿐이다
    }
}
