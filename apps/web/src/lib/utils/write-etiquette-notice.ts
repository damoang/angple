/**
 * 가입인사 글쓰기 전 예절 안내 자막 — 표시 여부 규칙.
 *
 * 화면(`write-etiquette-subtitle.svelte`)과 테스트가 **같은 함수를 import** 한다.
 * 규칙을 컴포넌트 안에 인라인으로 두면 테스트가 로직을 복붙하게 되고, 구현이 바뀌어도
 * 테스트는 영원히 초록이다 (2026-08-03 blocked-comment-filter 사고).
 *
 * ## 왜 hello 게시판만인가
 *
 * 가입인사는 **새 회원이 이 사이트에 처음 글을 쓰는 자리**다. 경어체·비속어 규정을
 * 모르고 첫 글에서 어기면, 본인은 영문을 모른 채 주의를 받고 시작한다. 규정을 읽을
 * 확률이 가장 낮은 사람에게 규정이 가장 필요한 순간이라 여기에만 붙인다.
 *
 * ⛔ 다른 게시판으로 확대하지 말 것. 매번 글 쓸 때마다 뜨는 안내는 안내가 아니라 소음이고,
 *    원주민이 가장 먼저 이탈한다.
 *
 * ## 왜 1회인가
 *
 * 사용자 결정(2026-08-05): "hello 게시판만 1회로". 두 번째부터는 이미 아는 사람에게
 * 화면을 가리는 비용만 남는다.
 */

/** localStorage 키 — 레벨 감지 스토어(`angple_lastKnownLevel`)와 같은 규약. */
export const ETIQUETTE_NOTICE_SEEN_KEY = 'angple_helloEtiquetteSeen';

/** 이 안내를 붙이는 게시판. 배열이 아니라 상수 하나 — 확대 압력을 코드로 막는다. */
export const ETIQUETTE_NOTICE_BOARD = 'hello';

export interface EtiquetteNoticeContext {
    /** 지금 글을 쓰는 게시판 */
    boardId: string;
    /** localStorage 에 이미 본 기록이 있는가 (없으면 null) */
    seenMark: string | null;
    /** 로그인 회원인가 — 비회원은 애초에 글을 못 쓴다 */
    isAuthenticated: boolean;
}

/**
 * 지금 자막을 띄울 것인가.
 *
 * ⛔ 서버에서는 호출하지 말 것. localStorage 를 읽어야 답이 정해지므로 SSR 에서 부르면
 *    hydration 불일치가 난다. 컴포넌트는 마운트 이후에만 이 함수를 부른다.
 */
export function shouldShowEtiquetteNotice(ctx: EtiquetteNoticeContext): boolean {
    if (ctx.boardId !== ETIQUETTE_NOTICE_BOARD) return false;
    if (!ctx.isAuthenticated) return false;
    return !ctx.seenMark;
}

/** 자막에 실을 문구. `/register/welcome` 의 규정 표현과 같은 말을 쓴다. */
export const ETIQUETTE_NOTICE_LINES: readonly string[] = [
    '다모앙은 경어체(존댓말)로 이야기합니다',
    '초성을 포함한 모든 비속어는 쓰지 않습니다'
];

/** 자막 한 줄이 머무는 시간(ms). */
export const ETIQUETTE_LINE_DURATION_MS = 2600;
