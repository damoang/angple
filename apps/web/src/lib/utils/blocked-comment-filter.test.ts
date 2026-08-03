import { describe, expect, it } from 'vitest';

/**
 * 차단 회원 댓글 숨김 규칙 (#13224).
 *
 * ⛔ 이 테스트는 **실제 구현을 import 한다.** 예전 판은 같은 로직을 복제해 두어
 *    구현이 바뀌어도 영원히 초록이었다(계약이 아니라 계약의 사본을 고정했다).
 *
 * 지키는 계약:
 *   1. 설정이 꺼져 있으면 **원본 배열을 그대로**(참조 동일) 돌려준다
 *   2. 답글이 없는 차단 댓글만 제외한다
 *   3. ⛔ 답글이 달린 차단 댓글은 제외하지 않는다 — 제3자의 답글이 부모를 잃는다
 */
import { filterVisibleComments } from './blocked-comment-filter';

type C = { id: number; depth: number; blocked: boolean };

const visible = (tree: C[], hide: boolean) =>
    filterVisibleComments(tree, hide, (c) => c.blocked);

const ids = (list: C[]) => list.map((c) => c.id);

describe('차단 회원 댓글 숨김 규칙', () => {
    it('설정 OFF 면 원본을 그대로 돌려준다 (참조 동일 — 불필요한 재렌더 방지)', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: false },
            { id: 2, depth: 0, blocked: true },
            { id: 3, depth: 0, blocked: false }
        ];
        expect(visible(tree, false)).toBe(tree);
    });

    it('답글 없는 차단 댓글은 제외한다', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: false },
            { id: 2, depth: 0, blocked: true },
            { id: 3, depth: 0, blocked: false }
        ];
        expect(ids(visible(tree, true))).toEqual([1, 3]);
    });

    it('⛔ 답글이 달린 차단 댓글은 남긴다 (제3자 답글 보호)', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: true }, // 차단 회원의 댓글
            { id: 2, depth: 1, blocked: false }, // 제3자의 답글
            { id: 3, depth: 0, blocked: false }
        ];
        expect(ids(visible(tree, true))).toEqual([1, 2, 3]);
    });

    it('마지막 댓글이 차단이면 제외한다 (next 없음)', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: false },
            { id: 2, depth: 0, blocked: true }
        ];
        expect(ids(visible(tree, true))).toEqual([1]);
    });

    it('차단 회원의 답글(depth 1)도 그 아래 답글이 없으면 제외한다', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: false },
            { id: 2, depth: 1, blocked: true },
            { id: 3, depth: 0, blocked: false }
        ];
        expect(ids(visible(tree, true))).toEqual([1, 3]);
    });

    it('차단 답글에 다시 답글이 달렸으면 남긴다', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: false },
            { id: 2, depth: 1, blocked: true },
            { id: 3, depth: 2, blocked: false }
        ];
        expect(ids(visible(tree, true))).toEqual([1, 2, 3]);
    });

    it('차단 댓글이 연속으로 있어도 각각 독립 판정한다', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: true }, // 답글 없음(다음도 depth 0) → 제외
            { id: 2, depth: 0, blocked: true }, // 답글 있음 → 남김
            { id: 3, depth: 1, blocked: false }
        ];
        expect(ids(visible(tree, true))).toEqual([2, 3]);
    });

    it('숨겨진 댓글은 답글을 가지지 않으므로 남은 답글은 항상 부모가 있다', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: true },
            { id: 2, depth: 0, blocked: true },
            { id: 3, depth: 1, blocked: false },
            { id: 4, depth: 0, blocked: false }
        ];
        const out = visible(tree, true);
        // depth 1 인 항목 앞에는 반드시 더 낮은 depth 가 남아 있어야 한다
        out.forEach((c, i) => {
            if (c.depth > 0) {
                const hasParent = out.slice(0, i).some((p) => p.depth < c.depth);
                expect(hasParent).toBe(true);
            }
        });
    });
});
