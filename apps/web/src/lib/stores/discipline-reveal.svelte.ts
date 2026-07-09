/**
 * 이용제한 근거 콘텐츠 공개 상태 스토어 (Svelte 5 Runes)
 *
 * #12920: 이용제한 근거 글·댓글을 [보기]로 공개하면 전체화면 워터마크를
 * 띄우기 위한 트리거. DisciplinedContent 인스턴스가 공개 시 자신의
 * Symbol 을 등록하고, 페이지는 revealCount > 0 이면 Watermark 를 렌더한다.
 * viewer 는 SSR(+page.server.ts)에서 내려준 열람자 정보(닉네임/ID/IP).
 */

let revealedIds = $state<Set<symbol>>(new Set());
let viewer = $state<{ nickname: string; userId: string; clientIp: string } | null>(null);

/**
 * 공개된 인스턴스 등록 (멱등 — 이미 있으면 무시)
 */
function add(id: symbol): void {
    if (revealedIds.has(id)) return;
    revealedIds = new Set([...revealedIds, id]);
}

/**
 * 인스턴스 등록 해제 (멱등 — 없으면 무시)
 */
function remove(id: symbol): void {
    if (!revealedIds.has(id)) return;
    const next = new Set(revealedIds);
    next.delete(id);
    revealedIds = next;
}

/**
 * 열람자 정보 설정 (게시글 상세 페이지 진입 시)
 */
function setViewer(v: { nickname: string; userId: string; clientIp: string } | null): void {
    viewer = v;
}

/**
 * 열람자 정보 초기화 (페이지 이탈 시 — 모듈 싱글톤 잔존 방지)
 */
function clearViewer(): void {
    viewer = null;
}

export const disciplineRevealStore = {
    get revealCount() {
        return revealedIds.size;
    },
    get viewer() {
        return viewer;
    },
    add,
    remove,
    setViewer,
    clearViewer
};
