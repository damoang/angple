/**
 * 로그인 후 복귀 주소 검사 (클라이언트)
 *
 * 규칙은 하나다 — **같은 사이트 상대 경로만 허용한다.**
 *
 * 2026-10-01 이전에는 광고주 초대(`https://ads.damoang.net/invite/...`)만 절대 주소로
 * 예외 허용했다. 그 예외가 오픈 리다이렉트의 유일한 입구였고, 초대 흐름은 실제로
 * 쓰이지 않는다(광고주 초대 마지막 사용 2026-06-30, 소셜 초대는 사용 0건). 예외를 없앤다.
 *
 * ⛔ `$lib/server/safe-redirect.ts` 를 화면에서 가져올 수 없다(서버 전용 모듈). 서버 쪽은
 *    운영상 필요한 다모앙 절대 주소를 아직 허용하므로 두 규칙은 의도적으로 다르다.
 */
export function sanitizeLoginRedirect(raw: string | null | undefined): string {
    if (!raw) return '/';

    // 스킴이 붙은 주소는 전부 거부한다 — `https:`·`javascript:`·`data:` 를 한 번에 막는다.
    if (!raw.startsWith('/')) return '/';

    // `//host`·`/\host` 는 브라우저가 프로토콜 상대 주소, 즉 외부 주소로 해석한다.
    if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';

    // 제어 문자(탭·개행 등)는 브라우저가 **제거한 뒤** 해석하므로 `/\t/evil.com` 같은 우회로가 된다.
    if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';

    // `/login` 으로 되돌리면 무한 루프가 된다.
    if (raw.startsWith('/login')) return '/';

    return raw;
}
