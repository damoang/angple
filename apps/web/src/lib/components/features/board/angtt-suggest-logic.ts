/**
 * 앙티티 크라우드 제안 — 순수 로직 (서버 라우트 · 커넥트 카드 공용)
 *
 * 작성자가 태그를 안 단 작품 글을 독자들이 제안으로 작품 페이지에 연결한다.
 * 서로 다른 회원 PROMOTE_THRESHOLD 명이 같은 작품을 제안하면 자동 승격(연결 확정).
 *
 * 임계·문구 판정은 전부 이 파일에 모은다 — 서버(승격 판정)와 카드(상태 문구)가
 * 서로 다른 숫자를 보지 않도록 단일 소스로 유지한다. (vitest 대상)
 */
import { RATING_MIN_LEVEL } from './post-rating-logic.js';

/** 제안 가능 최소 등급 — 글·작품 별점과 동일 기준(앙님💛, mb_level 3) 재사용 */
export const SUGGEST_MIN_LEVEL = RATING_MIN_LEVEL;

/** 서로 다른 회원 몇 명이 제안하면 자동 승격(연결 확정)되는가. 남용 관측 시 3으로 상향 */
export const PROMOTE_THRESHOLD = 2;

/** 회원당 일(24시간) 제안 상한 — idx_member_recent 인덱스 시크로 카운트 */
export const DAILY_SUGGEST_LIMIT = 10;

/** 제안을 받는 게시판 — angtt-auto-link 의 AUTO_LINK_BOARDS 와 동일 범위 */
const SUGGEST_BOARDS = new Set(['free', 'angtt']);

/** 이 게시판 글에 작품 연결 제안을 받을 수 있는가 */
export function isSuggestableBoard(boardId: string): boolean {
    return SUGGEST_BOARDS.has(boardId);
}

/** 서로 다른 제안자 수가 승격 임계에 도달했는가 */
export function shouldPromote(distinctVoters: number): boolean {
    return Number.isFinite(distinctVoters) && distinctVoters >= PROMOTE_THRESHOLD;
}

/** 승격까지 더 필요한 제안자 수 (음수 없음) */
export function remainingToPromote(distinctVoters: number): number {
    const n =
        Number.isFinite(distinctVoters) && distinctVoters > 0 ? Math.floor(distinctVoters) : 0;
    return Math.max(0, PROMOTE_THRESHOLD - n);
}

/** 카드 상태 문구 — "N명이 제안했어요 (승격까지 M명)" */
export function buildSuggestStatusText(count: number): string {
    const remaining = remainingToPromote(count);
    if (remaining === 0) return `${count}명이 제안했어요`;
    return `${count}명이 제안했어요 (승격까지 ${remaining}명)`;
}
