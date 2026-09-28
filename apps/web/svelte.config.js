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
            // 단일 번들 전략 유지. split(코드 분할) 전환 시 게시글 진입·목록에서
            // 청크 비동기 로딩이 컴포넌트 undefined($set 오류) 및 하이드레이션 실패
            // (HierarchyRequestError)를 유발해 "글이 안 열리고 화면이 깨지는" 회귀가
            // 광범위하게 발생했음(Chrome 데스크탑/모바일). 단일 번들은 청크 분할이
            // 없어 해당 캐스케이드를 원천 차단하므로 안정화를 위해 single 로 되돌림.
            // split 재도입은 별도 트랙에서 manualChunks/hydration 검증을 거친 뒤 진행.
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
