import { describe, expect, it } from 'vitest';

/**
 * 차단 회원 댓글 숨김 규칙 (#13224).
 *
 * 지키는 계약:
 *   1. 설정이 꺼져 있으면 목록이 그대로다 (기본값 OFF — 현행 100% 유지)
 *   2. 답글이 없는 차단 댓글만 제외한다
 *   3. ⛔ **답글이 달린 차단 댓글은 제외하지 않는다.** 부모를 없애면 거기 답글을 단
 *      제3자의 댓글이 부모를 잃는다 — 차단 대상이 아닌 사람이 피해를 본다.
 *
 * ⛔ "답글 있음" 판정은 parent_id 가 아니라 **다음 항목의 depth** 로 한다.
 *    운영 경로는 API 가 내려주는 depth 를 그대로 쓰는 평면 목록이라 parent_id 맵이 없다.
 *    이 테스트는 그 평면 구조를 그대로 흉내낸다.
 */

type C = { id: number; depth: number; blocked: boolean };

/** comment-list.svelte 의 visibleComments 와 동일한 규칙 */
function visible(tree: C[], hide: boolean): C[] {
    if (!hide) return tree;
    return tree.filter((c, i) => {
        if (!c.blocked) return true;
        const next = tree[i + 1];
        return !!next && (next.depth ?? 0) > (c.depth ?? 0);
    });
}

const ids = (list: C[]) => list.map((c) => c.id);

describe('차단 회원 댓글 숨김 규칙', () => {
    it('설정 OFF 면 아무것도 바뀌지 않는다 (기본값)', () => {
        const tree: C[] = [
            { id: 1, depth: 0, blocked: false },
            { id: 2, depth: 0, blocked: true },
            { id: 3, depth: 0, blocked: false }
        ];
        expect(ids(visible(tree, false))).toEqual([1, 2, 3]);
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
