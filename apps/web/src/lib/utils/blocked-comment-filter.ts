/**
 * 차단한 회원의 댓글을 목록에서 제외하는 규칙 (#13224).
 *
 * ⛔ **답글이 달린 댓글은 제외하지 않는다.** 부모를 없애면 거기 답글을 단 제3자의 댓글이
 *    부모를 잃고 맥락이 끊긴다 — 차단 대상이 아닌 사람이 피해를 본다.
 *
 * ⛔ "답글 있음" 을 `parent_id` 로 판정하면 운영에서 틀린다. 댓글 목록은 API 가 depth 를
 *    주면(운영 경로) **평면 목록 + depth** 를 그대로 쓰고 parent_id 맵을 만들지 않는다.
 *    두 경로 모두 **pre-order(부모 바로 뒤에 자식)** 평면 배열이므로
 *    **다음 항목의 depth 가 더 크면 답글 있음** 으로 판정한다.
 *    → 제외되는 항목은 자식이 0개이므로, 남은 답글은 언제나 부모가 살아 있다.
 *
 * ⛔ 이 규칙을 호출부에 인라인으로 복사하지 말 것. 예전에 테스트가 구현을 import 하지 않고
 *    같은 로직을 **복제**해 두어, 구현이 바뀌어도 테스트가 영원히 초록인 상태였다.
 *    구현과 테스트가 반드시 이 함수 하나를 공유한다.
 */

/** depth 를 가진 평면 댓글 목록의 최소 형태 */
export interface DepthNode {
    depth?: number;
}

/**
 * @param tree      pre-order 로 정렬된 평면 댓글 배열
 * @param hide      설정값. false 면 원본을 **그대로**(참조 동일) 돌려준다
 * @param isBlocked 차단 여부 판정자 (서버 플래그 + 클라 스토어 결합은 호출부 책임)
 */
export function filterVisibleComments<T extends DepthNode>(
    tree: T[],
    hide: boolean,
    isBlocked: (comment: T) => boolean
): T[] {
    if (!hide) return tree;
    return tree.filter((c, i) => {
        if (!isBlocked(c)) return true;
        const next = tree[i + 1];
        return !!next && (next.depth ?? 0) > (c.depth ?? 0);
    });
}
