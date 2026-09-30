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
            // ── 3차 재시도 (2026-09-30) ──
            // 재시도 조건을 먼저 갖췄다. 없이 켜면 세 번째로 실패한다.
            //   ✅ 관측: 카나리 브라우저 검사가 **레인 2개**를 본다(#2324) —
            //      청크 레인(2차 지문) + 하이드레이션 레인($set·HierarchyRequestError·
            //      Failed to hydrate = 1차 지문). 목록→글 **클릭 이동(SPA)** 과 뒤로가기
            //      복귀, 셸·본문 존재까지 단언한다. 현행 single 에서 전부 통과함(대조군).
            //   ✅ 설정: R2 자산 CORS `AllowedOrigins: ["*"]`, `acao_watch.py` 가 감시(크론).
            //   ⛔ 2차 원인인 `modulepreload` HTML 주입은 **넣지 않는다**(#2303 에서 제거된 채 유지).
            //   ⛔ 자산 업로드는 `aws s3 sync` 로 디렉터리 전체 — 청크 수가 늘어도 누락 없음(확인).
            // 카나리에서 실패하면 즉시 single 로 되돌리고 원인을 규명한다.
            bundleStrategy: 'split',
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
