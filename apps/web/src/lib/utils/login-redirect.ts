/**
 * 로그인 후 복귀 주소 검사 (클라이언트)
 *
 * 두 가지만 통과시킨다.
 *  1. 같은 사이트 **상대 경로**
 *  2. 아래 허용목록에 있는 **다모앙 호스트의 절대 주소**
 *
 * ## ⛔ 2번을 지우면 서브도메인 로그인이 깨진다
 *
 * `ads.damoang.net`(광고주 대시보드·홍보 게시판 기간 설정)과 `ops.damoang.net`(운영 콘솔)은
 * 별도 서비스이고, 로그인은 damoang.net 에서 한 뒤 **자기 오리진으로 돌아온다.** 그 복귀
 * 주소는 상대 경로로 쓸 수 없다 — 오리진이 다르다. 실제 호출부:
 *
 * ```
 * damoang-ads  apps/dashboard/src/lib/api/base-client.ts:33   redirect=<https://ads.damoang.net/...>
 * damoang-ads  apps/dashboard/src/lib/stores/auth.svelte.ts:142
 * damoang-ads  apps/dashboard/src/routes/(public)/login/+page.svelte:52
 * damoang-ops  apps/singo/src/hooks.server.ts:28               redirect=<https://ops.damoang.net/...>
 * damoang-ops  apps/singo/src/routes/(auth)/login/+page.svelte:30
 * ```
 *
 * 2026-10-01 에 「상대 경로만 허용」으로 좁혔다가 이 다섯 곳을 끊었다(#2336). 초대 흐름이
 * 휴면인 것과 절대 주소가 불필요한 것은 다른 얘기였다.
 *
 * ## ⭐ 막는 것은 「문자열 포함 검사」다
 *
 * 호스트는 `new URL()` 로 파싱해 **정확히 일치**를 본다. `https://외부/?x=damoang.net` ·
 * `https://damoang.net@외부/` · `damoang.net.외부` 가 전부 걸러진다.
 *
 * ⛔ `$lib/server/safe-redirect.ts` 를 화면에서 가져올 수 없다(서버 전용 모듈). 허용 호스트
 *    목록이 두 곳에 있으니 한쪽만 고치지 마라 — 서버가 최종 싱크다.
 */
const ALLOWED_ABSOLUTE_HOSTS = new Set([
    'damoang.net',
    'www.damoang.net',
    'ads.damoang.net',
    'ops.damoang.net'
]);

/** 이 호스트들의 `/login` 은 자기 자신이라 무한 루프가 된다. */
const SELF_HOSTS = new Set(['damoang.net', 'www.damoang.net']);

export function sanitizeLoginRedirect(raw: string | null | undefined): string {
    if (!raw) return '/';

    if (raw.startsWith('/')) {
        // `//host`·`/\host` 는 브라우저가 프로토콜 상대 주소, 즉 외부 주소로 해석한다.
        if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
        // 제어 문자(탭·개행 등)는 브라우저가 **제거한 뒤** 해석하므로 우회로가 된다.
        if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
        // `/login` 으로 되돌리면 무한 루프가 된다.
        if (raw.startsWith('/login')) return '/';
        return raw;
    }

    // 다모앙 호스트의 절대 주소만 허용한다. 서버 `safeRedirectUrl` 과 같은 정책이다.
    try {
        const u = new URL(raw);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return '/';
        if (!ALLOWED_ABSOLUTE_HOSTS.has(u.hostname)) return '/';
        // 절대 주소로 쓴 **우리** 로그인 화면도 루프다 — 상대 경로 쪽 검사가 이건 못 잡는다.
        // ⛔ 서브도메인의 `/login` 은 우리 루프가 아니다. ops 는 자기 로그인 화면이 따로 있다.
        if (SELF_HOSTS.has(u.hostname) && u.pathname.startsWith('/login')) return '/';
        return u.toString();
    } catch {
        return '/';
    }
}
