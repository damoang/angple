import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// 환경 변수로 어댑터 선택 (ADAPTER=static으로 정적 빌드)
const isStatic = process.env.ADAPTER === 'static';

const adapter = isStatic
    ? adapterStatic({
          pages: 'build',
          assets: 'build',
          fallback: 'index.html', // SPA 모드 (동적 라우팅 지원)
          precompress: false,
          strict: true
      })
    : adapterNode({
          out: 'build',
          precompress: true,
          envPrefix: ''
      });

const assetBaseUrl = (process.env.ASSET_BASE_URL || '').replace(/\/+$/, '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://svelte.dev/docs/kit/integrations
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        adapter,
        paths: {
            assets: assetBaseUrl
        },
        alias: {
            $widgets: '../../widgets',
            '$custom-widgets': '../../custom-widgets',
            $themes: '../../themes',
            $plugins: '../../plugins',
            '$premium-plugins': '../../../premium/plugins',
            '@angple/types': '../../packages/types/src',
            '@angple/hook-system': '../../packages/hook-system/src',
            '@angple/i18n': '../../packages/i18n/src',
            '@angple/i18n/messages': '../../packages/i18n/messages',
            '@angple/theme-engine': '../../packages/theme-engine/src'
        },
        csrf: {
            // 자체 CSRF 보호 사용 (세션 기반 double-submit cookie, hooks.server.ts)
            // Apple Sign In form_post 등 cross-origin POST 허용을 위해 모든 origin 허용
            trustedOrigins: ['*']
        },
        output: {
            // ── 코드 분할 이력 (지우지 말 것. 두 번 실패했고 원인이 서로 다르다) ──
            //
            // 1차 b82ce66b 2026-06-28(#1685) → 58c10665 **6/29**(#1691) 롤백 — 하루 만에
            //   게시글 진입·목록에서 청크 비동기 로딩이 컴포넌트 undefined($set 오류) 및
            //   하이드레이션 실패(HierarchyRequestError)를 유발해 "글이 안 열리고 화면이
            //   깨지는" 회귀가 광범위하게 발생(Chrome 데스크탑/모바일).
            //   회원 신고 #12836(좌측 메뉴·로그인 메뉴바 미출력) #12842(클릭하면 안 열리고,
            //   두 번째에 열리는데 목록이 안 나타남) #12844.
            //   ⭐ `?_v=`(자산복구) 적용 상태에서도 재현 → 단순 캐시 아님.
            // 2차 3b8a7a45 2026-09-28(#2303) → 3beefee1 9/29(#2305) 롤백
            //   CORS 모드 혼용 — `<link rel="modulepreload">` 를 `crossorigin` 없이 HTML 에
            //   주입 → 청크 로드 실패 → 복구 리로드 무한루프.
            //
            // ── 3차 재시도와 롤백 (2026-09-30, 같은 날) ──
            // 재시도 조건(관측 레인 2개 #2324 · 데스크탑·Firefox 매트릭스 #2326 · ACAO `*` + 감시기)을
            // 갖추고 켰다. 카나리 3조합은 전부 통과했으나 **운영에서 실패율이 2배가 되어 되돌렸다.**
            //
            // 실측(사람 기준·봇 제외·겹치지 않는 15분 구간 13개):
            //   재로드율 single 2.2% → split 약 4% · 3시간째 감쇠 없음
            //   Desktop Firefox 181/1k · iOS(WebKit) 157/1k
            //   Android Chrome 25.6 · macOS Safari 23.8 · Desktop Chrome 10.4 · Samsung 2.9
            //   ⛔ 「모바일이라서」도(Android Chrome 25.6) 「엔진이라서」도(macOS Safari 23.8) 아니다
            //
            // ⭐ **원인은 청크 개수다.** `__vite__mapDeps` 실측 — 라우트 147개의 의존 파일 수가
            //    최소 3 · **중앙값 33** · 평균 39.6 · **최대 214**. SPA 이동 한 번에 파일 33개를 받는다.
            //    파일당 실패확률 p 로 역산하면 전체 0.12% · iOS 0.52% — 모바일 회선에서 흔한 값이다.
            //    즉 split 이 **1개 fetch 를 33개로 만들어 노출을 33배**로 키웠다. 브라우저 버그가 아니다.
            //
            // ⛔ 기각한 가설(전부 측정으로): 구 HTML 전이(실패 URL 이 전부 현 릴리스) · 봇 오염(제외해도
            //    동일) · 엣지 캐시 콜드(ICN 148개 데운 뒤에도 동일, Smart Tiered Cache 는 이미 on) ·
            //    청크 서빙 장애(표본 12/12 가 200·ACAO `*`) · CSS 모드 혼용(`Unable to preload CSS` 0건).
            //
            // ⛔ **재시도로 덮을 수 없다** — HTML 사양상 모듈 fetch 가 실패하면 그 URL 의 module map
            //    항목이 `null` 로 박히고, **같은 문서에서 같은 URL 재 import 는 네트워크 없이 즉시 실패**한다.
            //    그래서 복구가 **전체 재로드**(새 문서=새 module map)를 쓴다. 이 구현이 옳다.
            //    우리 데이터도 그것과 맞는다 — 1명당 1.1~1.4건, **첫 재로드에 늘 해결**.
            //
            // ── 4차를 한다면: manualChunks 로 라우트당 파일 수를 줄여라 ──
            // 33 → 5 수준으로 줄이면 노출이 6~7배 감소한다. 최대 214 라우트부터 손대라.
            // ⭐ 검증 가능한 예측: 라우트당 파일 수를 N배 줄이면 실패율이 대략 N배 줄어야 한다.
            //    안 줄면 이 가설이 틀린 것이다.
            // 도구는 준비돼 있다 — 카나리 매트릭스 4조합(webkit 포함) `canary-check.yml`,
            // 청크 실패 원인 계측(#2329, `route_load_reason.sh`), `acao_watch` 참조모드 검사.
            // 관련 문서: docs/2026-09-30-code-split-retry-sprint.html · -rollback-runbook.html
            bundleStrategy: 'single',
            // modulepreload: 브라우저 기본 동작에 위임하여 불필요한 prefetch 감소
            preloadStrategy: 'modulepreload'
        },
        version: {
            // 주기적 버전 폴링은 배포 직후 불필요한 새로고침 UX를 유발할 수 있으므로 비활성화.
            pollInterval: 0
        }
    },
    compilerOptions: {
        runes: true //룬 모드 강제 적용
    }
};

export default config;
