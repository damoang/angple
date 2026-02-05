import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    // .env.local 파일 로드 (루트 + 앱 디렉터리)
    const env = loadEnv(mode, process.cwd(), '');
    const rootEnv = loadEnv(mode, path.resolve(__dirname, '../..'), '');

    // 환경 변수 (앱 > 루트 > 기본값 순서로 우선순위)
    const port = parseInt(env.VITE_PORT || rootEnv.ADMIN_PORT || '3011');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8081';
    const allowedHosts = (env.VITE_ALLOWED_HOSTS || 'localhost,admin.damoang.net').split(',');

    return {
        plugins: [tailwindcss(), sveltekit()],
        server: {
            port,
            allowedHosts,
            proxy: {
                '/api/v2': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            proxyReq.setHeader('Origin', apiProxyTarget);
                            console.log('[Proxy]', req.method, req.url);
                        });
                    }
                }
            }
        },
    test: {
        expect: { requireAssertions: true },
        projects: [
            {
                extends: './vite.config.ts',
                test: {
                    name: 'client',
                    environment: 'browser',
                    browser: {
                        enabled: true,
                        provider: 'playwright',
                        instances: [{ browser: 'chromium' }]
                    },
                    include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
                    exclude: ['src/lib/server/**'],
                    setupFiles: ['./vitest-setup-client.ts']
                }
            },
            {
                extends: './vite.config.ts',
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
                }
            }
        ]
    }
});
