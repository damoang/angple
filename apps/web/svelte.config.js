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

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://svelte.dev/docs/kit/integrations
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        adapter,
        csrf: {
            // 개발 환경에서 localhost CSRF 허용
            checkOrigin: process.env.NODE_ENV === 'production'
        }
    },
    compilerOptions: {
        runes: true //룬 모드 강제 적용
    }
};

export default config;
