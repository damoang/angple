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
            $plugins: '../../plugins'
        },
        csrf: {
            // 자체 CSRF 보호 사용 (세션 기반 double-submit cookie, hooks.server.ts)
            // Apple Sign In form_post 등 cross-origin POST 허용을 위해 모든 origin 허용
            trustedOrigins: ['*']
        },
        output: {
            // 청크 수를 줄이기 위해 단일 번들 전략 사용
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
