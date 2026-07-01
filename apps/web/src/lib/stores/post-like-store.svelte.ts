/**
 * 공감/비공감 낙관적 상태 스토어 (세션 인메모리)
 *
 * 공감 상태는 트래픽 다이어트로 SSR에서 로드되는데, 사용자가 방금 누른
 * 공감이 SSR/백엔드 조회에 아직 반영되기 전 SPA로 재진입하면 "공감 안 됨"으로
 * 보이고 새로고침해야 반영되는 문제가 있었다.
 *
 * 이 스토어는 "이 세션에서 사용자가 직접 누른 마지막 공감/비공감"을 기억해,
 * 글 재진입 시 아직 반영 안 된 SSR 값보다 우선 표시한다(낙관적 오버레이).
 * - 인메모리(모듈 스코프)라 전체 새로고침 시 초기화 → 그때는 SSR이 권위 소스.
 * - localStorage 미사용: "내 방금 액션"만 다루므로 세션 범위로 충분.
 */

interface LikeState {
    liked: boolean;
    disliked: boolean;
}

const map = new Map<string, LikeState>();

function keyFor(boardId: string, postId: number): string {
    return `${boardId}:${postId}`;
}

export const postLikeStore = {
    /** 사용자가 직접 토글한 공감/비공감 상태 기록 */
    set(boardId: string, postId: number, state: LikeState): void {
        map.set(keyFor(boardId, postId), { liked: state.liked, disliked: state.disliked });
    },

    /** 이 세션에서 기록된 내 공감 상태 (없으면 undefined) */
    get(boardId: string, postId: number): LikeState | undefined {
        return map.get(keyFor(boardId, postId));
    }
};
