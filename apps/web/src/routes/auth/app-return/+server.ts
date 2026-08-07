import type { RequestHandler } from './$types';

/**
 * GET /auth/app-return?code=… | ?error=…&provider=…
 *
 * 네이티브 앱 OAuth 복귀 인터스티셜.
 *
 * 배경(#app-login-404): 콜백에서 앱 스킴(damoang://oauth-callback)으로 **서버 302**를
 * 보내면 iOS(ASWebAuthenticationSession)는 가로채지만, Android Chrome 커스텀 탭은
 * 서버발 커스텀 스킴 리다이렉트를 차단하고 에러 페이지를 띄운다(사용자 제보: "404가
 * 스쳐간다", 로그인 실패). 그래서 같은 오리진의 이 페이지로 302 한 뒤,
 *  1) JS location.replace 로 스킴 이동(iOS 세션이 이 시점에 가로챔)
 *  2) Android 는 intent:// 폴백(스킴+패키지 명시)으로 재시도
 *  3) 자동 이동이 막히면 사용자가 버튼을 눌러 복귀(사용자 제스처는 항상 허용)
 *
 * 전달 파라미터는 code/error/provider 만 화이트리스트로 통과시킨다.
 */
const APP_SCHEME_BASE = 'damoang://oauth-callback';
const ANDROID_PACKAGE = 'net.damoang.community';
const PASS_PARAMS = ['code', 'error', 'provider'] as const;

export const GET: RequestHandler = async ({ url }) => {
    const qs = new URLSearchParams();
    for (const key of PASS_PARAMS) {
        const v = url.searchParams.get(key);
        if (v) qs.set(key, v);
    }
    const query = qs.toString();
    const appUrl = query ? `${APP_SCHEME_BASE}?${query}` : APP_SCHEME_BASE;
    const intentUrl =
        `intent://oauth-callback${query ? `?${query}` : ''}` +
        `#Intent;scheme=damoang;package=${ANDROID_PACKAGE};end`;

    const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>다모앙 앱으로 돌아가는 중…</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column;
         align-items: center; justify-content: center; min-height: 90vh; gap: 16px;
         background: #fafafa; color: #222; margin: 0; padding: 24px; text-align: center; }
  a.btn { display: inline-block; padding: 14px 28px; border-radius: 12px; background: #222;
          color: #fff; text-decoration: none; font-size: 16px; font-weight: 600; }
  p { color: #666; font-size: 14px; margin: 0; }
</style>
</head>
<body>
<p id="msg">다모앙 앱으로 돌아가는 중…</p>
<a class="btn" href="${appUrl}" id="open">다모앙 앱 열기</a>
<script>
  (function () {
    var appUrl = ${JSON.stringify(appUrl)};
    var intentUrl = ${JSON.stringify(intentUrl)};
    var isAndroid = /android/i.test(navigator.userAgent);
    // iOS: 인증 세션이 이 네비게이션을 가로채 앱으로 복귀한다.
    // Android: 스킴 직행이 막히면 intent:// 로 한 번 더 시도한다.
    try { window.location.replace(appUrl); } catch (e) {}
    if (isAndroid) {
      document.getElementById('open').setAttribute('href', intentUrl);
      setTimeout(function () {
        try { window.location.replace(intentUrl); } catch (e) {}
      }, 400);
    }
  })();
</script>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
};
