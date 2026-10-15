/**
 * 페이지를 연 뒤 활성 플러그인 목록을 API 로 다시 받아야 하는지.
 *
 * 페이지 데이터에는 활성 플러그인 목록이 이미 실려 온다. API 로 다시 받는 이유는 하나다 —
 * 페이지가 **캐시에서 나온 것**이면 그 목록이 낡았을 수 있다(관리자가 방금 플러그인을 켜거나 껐을 때).
 *
 * 로그인 응답은 캐시되지 않는다. 요청마다 새로 만들고, API 와 같은 서버 캐시에서 목록을 읽는다.
 * 그 목록은 API 응답과 같은 값이므로 다시 받을 이유가 없다.
 *
 * 비로그인 응답은 캐시에서 나올 수 있지만, 페이지가 만들어진 지 얼마 안 됐으면 그 목록도
 * API 응답과 다를 이유가 없다. 서버가 페이지를 만든 시각(renderedAt)을 같이 내려주므로,
 * 그 시각에서 기준 시간 이상 지난 페이지만 다시 받는다.
 */

/** 이보다 오래된 페이지만 활성 플러그인 목록을 다시 받는다. */
export const ACTIVE_PLUGINS_STALE_AFTER_MS = 60_000;

export function shouldRefreshActivePlugins(input: {
    /** 페이지 데이터에 실려 온 활성 플러그인 수 */
    ssrPluginCount: number;
    /** 서버가 이 응답을 로그인 회원용으로 만들었는가(페이지 데이터의 isLoggedIn) */
    ssrLoggedIn: boolean | null | undefined;
    /** 서버가 페이지 데이터를 만든 시각(epoch ms, 페이지 데이터의 renderedAt) */
    renderedAt?: number | null;
    /** 지금 시각(epoch ms). 테스트용 — 생략하면 Date.now() */
    now?: number;
}): boolean {
    if (input.ssrPluginCount <= 0) return false;
    // 값이 없거나 참이 아니면(이전 버전 응답, 비로그인) 아래 시각 판단으로 넘어간다.
    if (input.ssrLoggedIn === true) return false;

    const renderedAt = input.renderedAt;
    // 만든 시각이 실려 오지 않은 응답(이전 버전 HTML)은 이전처럼 다시 받는다.
    if (typeof renderedAt !== 'number' || !Number.isFinite(renderedAt)) return true;

    const age = (input.now ?? Date.now()) - renderedAt;
    // 서버 시각과 브라우저 시각은 다를 수 있다. 만든 시각이 기준 시간 이상 「미래」로 보이면
    // 브라우저 시계를 믿을 수 없다는 뜻이므로 안전하게 다시 받는다.
    if (age <= -ACTIVE_PLUGINS_STALE_AFTER_MS) return true;
    return age >= ACTIVE_PLUGINS_STALE_AFTER_MS;
}
