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
