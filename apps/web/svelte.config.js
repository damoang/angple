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
            // 코드 분할 사용(SvelteKit 기본). 앱이 커지며 단일 번들의 단점이 큼:
            //  - 매 배포마다 전체 번들 해시 변경 → 재방문자가 전체 재다운로드(캐시 재사용 0)
            //  - Three.js 등 무거운 동적 import 가 모든 페이지에 인라인
            // 분할 시 벤더/라우트 청크가 배포 간 캐시 유지되어 대역폭·로드 모두 개선.
            // (Cloudflare h2/h3 멀티플렉싱이라 청크 다수의 요청 오버헤드는 미미)
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
