import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    // .env.local 파일 로드 (루트 + 앱 디렉터리)
    const env = loadEnv(mode, process.cwd(), '');
    const rootEnv = loadEnv(mode, path.resolve(__dirname, '../..'), '');

    // 환경 변수 (앱 > 루트 > 기본값 순서로 우선순위)
    const port = parseInt(env.VITE_PORT || rootEnv.WEB_PORT || '3010');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8081';
    const allowedHosts = (env.VITE_ALLOWED_HOSTS || 'localhost,web.damoang.net,damoang.dev').split(',');

    return {
        plugins: [tailwindcss(), sveltekit()],
        resolve: {
            alias: {
                $themes: path.resolve(__dirname, '../../themes'),
                $widgets: path.resolve(__dirname, '../../widgets'),
                '$custom-widgets': path.resolve(__dirname, '../../custom-widgets')
            }
        },
        server: {
            port,
            allowedHosts,
            fs: {
                allow: ['.', '../..']
            },
            proxy: {
                '/api/v2': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            // Origin 헤더를 백엔드 URL로 변경
                            proxyReq.setHeader('Origin', apiProxyTarget);
                            console.log('[Proxy]', req.method, req.url);
                        });
                    }
                }
            }
        },
        test: {
            expect: { requireAssertions: true },
            coverage: {
                provider: 'v8',
                reporter: ['text', 'lcov', 'json-summary'],
                reportsDirectory: './coverage',
                include: ['src/lib/**/*.ts'],
                exclude: [
                    'src/lib/**/*.svelte.ts',
                    'src/lib/**/*.d.ts',
                    'src/lib/**/index.ts',
                    'src/lib/components/ui/**'
                ],
                thresholds: {
                    lines: 60,
                    functions: 60,
                    branches: 60,
                    statements: 60
                }
            },
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
    };
});
