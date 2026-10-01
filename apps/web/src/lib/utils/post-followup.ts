/**
 * 글 상세가 화면이 뜬 뒤 따로 부르는 호출(추천 상태·반응)을 낼지 말지 정한다.
 *
 * 서버는 같은 값을 페이지와 함께 흘려보낸다(streamed.auxiliaryData). 브라우저가 그 뒤에
 * 다시 부르는 것은 「서버가 그 회원을 몰랐을 수 있을 때」만 의미가 있다. 여기서 그 조건을
 * 한곳에 모아 둔다 — 화면 코드에 흩어져 있으면 같은 호출이 두 번 나간다.
 */

export interface LikeFallbackInput {
    /** 서버가 흘려보낸 부가 데이터가 이미 도착했는가 */
    auxiliaryLoaded: boolean;
    /** 로그인 여부 판정이 아직 진행 중인가 */
    authLoading: boolean;
    /** 로그인 상태인가 */
    authenticated: boolean;
}

/**
 * 진입 시 추천 상태 대체 호출을 낼지.
 *
 * 로그인 회원은 인증 확립 뒤 재조회가 따로 한 번 나가므로 여기서 또 부르면 중복이다.
 * 판정이 끝나기 전에는 부르지 않는다(끝난 뒤 다시 판단한다).
 */
export function shouldRunLikeFallback(input: LikeFallbackInput): boolean {
    if (input.authLoading) return false;
    if (input.authenticated) return false;
    return !input.auxiliaryLoaded;
}

export interface ReactionsRefetchInput {
    /** 지금 보려는 글의 반응 묶음 식별자 */
    parentId: string;
    /** 서버가 흘려보낸 반응이 어느 글 것인지(없으면 null) */
    streamedParentId: string | null;
    /** 서버가 반응을 조회할 때 회원을 알고 있었는가 */
    streamedViewerKnown: boolean;
    authLoading: boolean;
    authenticated: boolean;
}

/**
 * 서버가 이미 보낸 반응이 있어 다시 부르지 않아도 되는지.
 *
 * 반응 개수는 누구에게나 같지만 「내가 누른 반응」 표시는 회원별이다. 서버가 회원을 모른 채
 * 조회했는데 브라우저는 로그인 상태라면(세션 쿠키만 먼저 만료된 경우) 내 표시가 빠져 있으므로
 * 다시 불러야 한다. 로그인 판정이 안 끝났으면 알 수 없으니 부른다.
 */
export function canSkipReactionsRefetch(input: ReactionsRefetchInput): boolean {
    if (!input.streamedParentId || input.streamedParentId !== input.parentId) return false;
    if (input.streamedViewerKnown) return true;
    if (input.authLoading) return false;
    return !input.authenticated;
}

/**
 * 추천한 사람 미리보기 — 서버가 페이지와 함께 보낼지, 화면이 따로 부를지.
 *
 * 추천한 사람의 신원은 로그인 회원에게만 보여 준다. 비로그인용 페이지는 캐시되어 여러 사람에게
 * 나가므로, 서버는 **세션으로 확인된 회원**일 때만 싣는다.
 */

/** 서버가 글의 추천한 사람 미리보기를 실어야 하는가 */
export function shouldPreviewPostLikers(input: {
    sessionUserId: string | null | undefined;
    postLikes: number | null | undefined;
}): boolean {
    return Boolean(input.sessionUserId) && (input.postLikes ?? 0) > 0;
}

/** 서버가 미리보기를 실을 댓글 ID — 세션 회원일 때만, 추천이 있는 댓글만, 한도까지 */
export function commentIdsForLikersPreview(input: {
    sessionUserId: string | null | undefined;
    comments: ReadonlyArray<{ id: number | string; likes?: number | null }>;
    max: number;
}): number[] {
    if (!input.sessionUserId) return [];
    const ids: number[] = [];
    for (const c of input.comments) {
        if ((c.likes ?? 0) <= 0) continue;
        const id = Number(c.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        ids.push(id);
        if (ids.length >= input.max) break;
    }
    return ids;
}

export type PostLikersAction = 'use-preview' | 'fetch' | 'none';

/**
 * 서버 전달분이 도착한 뒤 글의 추천한 사람을 어떻게 채울지.
 * 미리보기가 실려 왔으면 그것을 쓰고, 없으면(서버가 싣지 않았거나 실패) 추천이 있는 글만 따로 부른다.
 */
export function decidePostLikers(input: {
    preview: unknown;
    postLikes: number | null | undefined;
}): PostLikersAction {
    if (isLikersPreview(input.preview)) return 'use-preview';
    return (input.postLikes ?? 0) > 0 ? 'fetch' : 'none';
}

export function isLikersPreview(value: unknown): value is { likers: unknown[]; total: number } {
    if (!value || typeof value !== 'object') return false;
    const v = value as { likers?: unknown; total?: unknown };
    return Array.isArray(v.likers) && typeof v.total === 'number';
}

/**
 * 댓글 목록이 추천한 사람을 따로 불러야 하는 댓글 ID.
 *
 * 서버 전달분을 기다리는 중이면 아무것도 부르지 않는다(먼저 부르면 같은 것을 두 번 받는다).
 * 이미 채워졌거나 요청 중이거나 재시도 한도를 넘긴 댓글은 뺀다.
 */
export function commentLikerIdsToFetch(input: {
    previewPending: boolean;
    comments: ReadonlyArray<{ id: number | string; likes?: number | null }>;
    loaded: { has(id: string): boolean };
    inflight: { has(id: string): boolean };
    attempts: { get(id: string): number | undefined };
    maxAttempts: number;
}): string[] {
    if (input.previewPending) return [];
    const ids: string[] = [];
    for (const c of input.comments) {
        if ((c.likes ?? 0) <= 0) continue;
        const id = String(c.id);
        if (input.loaded.has(id) || input.inflight.has(id)) continue;
        if ((input.attempts.get(id) ?? 0) >= input.maxAttempts) continue;
        ids.push(id);
    }
    return ids;
}

/**
 * 서버가 보낸 글의 추천한 사람 미리보기를 화면에 반영해도 되는지.
 *
 * 미리보기는 페이지를 만들 때의 값이다. 그 뒤 화면이 직접 받아 온 값(추천을 누른 직후,
 * 목록을 연 뒤, 대기 한도를 넘겨 직접 받은 뒤)이 있으면 그쪽이 더 새롭다 — 덮으면 안 된다.
 * 다른 글의 미리보기도 반영하지 않는다.
 */
export function shouldApplyLikersPreview(input: {
    previewPostId: number;
    currentPostId: number | null | undefined;
    directFetchedPostId: number | null;
}): boolean {
    if (input.previewPostId !== input.currentPostId) return false;
    return input.directFetchedPostId !== input.previewPostId;
}
