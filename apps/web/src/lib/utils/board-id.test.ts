import { describe, it, expect } from 'vitest';
import { isValidBoardId } from './board-id';

describe('isValidBoardId — 라우트 이탈로 사라진 boardId 판정', () => {
    it('정상 게시판 이름은 통과', () => {
        for (const v of ['free', 'qa', 'angmap', 'hello', 'bug_report', 'a-b']) {
            expect(isValidBoardId(v)).toBe(true);
        }
    });

    it('⛔ 문자열 "undefined"/"null" 은 무효 — 템플릿 리터럴로 URL 에 박히는 실제 사고 값', () => {
        expect(isValidBoardId('undefined')).toBe(false);
        expect(isValidBoardId('null')).toBe(false);
    });

    it('빈 값·비문자열은 무효', () => {
        for (const v of ['', undefined, null, 0, 123, {}, []]) {
            expect(isValidBoardId(v)).toBe(false);
        }
    });
});
