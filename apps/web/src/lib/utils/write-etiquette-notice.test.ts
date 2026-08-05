import { describe, expect, it } from 'vitest';
import {
    ETIQUETTE_NOTICE_BOARD,
    ETIQUETTE_NOTICE_LINES,
    shouldShowEtiquetteNotice,
    type EtiquetteNoticeContext
} from './write-etiquette-notice';

const ctx = (o: Partial<EtiquetteNoticeContext> = {}): EtiquetteNoticeContext => ({
    boardId: ETIQUETTE_NOTICE_BOARD,
    seenMark: null,
    isAuthenticated: true,
    ...o
});

describe('shouldShowEtiquetteNotice', () => {
    it('가입인사 첫 글쓰기에서 뜬다', () => {
        expect(shouldShowEtiquetteNotice(ctx())).toBe(true);
    });

    // ⛔ 사용자 결정(2026-08-05) "hello 게시판만 1회로" 의 방어선.
    it('한 번 본 사람에게는 다시 뜨지 않는다', () => {
        expect(shouldShowEtiquetteNotice(ctx({ seenMark: '1' }))).toBe(false);
        expect(shouldShowEtiquetteNotice(ctx({ seenMark: '2026-08-05T00:00:00.000Z' }))).toBe(
            false
        );
    });

    // ⛔ 이 테스트가 확대 압력을 막는다. 매 글마다 뜨는 안내는 소음이다.
    it('다른 게시판에서는 뜨지 않는다', () => {
        for (const board of ['free', 'promotion', 'bug', 'trade', '']) {
            expect(shouldShowEtiquetteNotice(ctx({ boardId: board }))).toBe(false);
        }
    });

    it('비로그인 상태에서는 뜨지 않는다', () => {
        expect(shouldShowEtiquetteNotice(ctx({ isAuthenticated: false }))).toBe(false);
    });
});

describe('ETIQUETTE_NOTICE_LINES', () => {
    // 문구가 규정과 어긋나면 안내가 아니라 오정보다.
    it('경어체와 초성 비속어를 모두 다룬다', () => {
        const all = ETIQUETTE_NOTICE_LINES.join(' ');
        expect(all).toContain('경어체');
        expect(all).toContain('초성');
    });

    // ⛔ 어투 규약: 안내문은 존댓말. 자막이 반말이면 그 자체로 규정 위반 예시가 된다.
    it('모든 줄이 존댓말로 끝난다', () => {
        for (const line of ETIQUETTE_NOTICE_LINES) {
            expect(line).toMatch(/(습니다|합니다|해요|세요)$/);
        }
    });
});
