/**
 * 페이지를 연 뒤 활성 플러그인 목록을 API 로 다시 받아야 하는지.
 *
 * 페이지 데이터에는 활성 플러그인 목록이 이미 실려 온다. API 로 다시 받는 이유는 하나다 —
 * 페이지가 **캐시에서 나온 것**이면 그 목록이 낡았을 수 있다(관리자가 방금 플러그인을 켜거나 껐을 때).
 *
 * 로그인 응답은 캐시되지 않는다. 요청마다 새로 만들고, API 와 같은 서버 캐시에서 목록을 읽는다.
 * 그 목록은 API 응답과 같은 값이므로 다시 받을 이유가 없다.
 */
export function shouldRefreshActivePlugins(input: {
    /** 페이지 데이터에 실려 온 활성 플러그인 수 */
    ssrPluginCount: number;
    /** 서버가 이 응답을 로그인 회원용으로 만들었는가(페이지 데이터의 isLoggedIn) */
    ssrLoggedIn: boolean | null | undefined;
}): boolean {
    if (input.ssrPluginCount <= 0) return false;
    // 값이 없거나 참이 아니면(이전 버전 응답, 비로그인) 이전처럼 다시 받는다.
    return input.ssrLoggedIn !== true;
}
