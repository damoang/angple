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
    const allowedHosts = (env.VITE_ALLOWED_HOSTS || 'localhost').split(',');

    return {
        plugins: [tailwindcss(), sveltekit()],
        optimizeDeps: {
            include: ['@tiptap/suggestion', '@tiptap/pm/state']
        },
        build: {
            assetsInlineLimit: 0,
            chunkSizeWarningLimit: 1120
        },
        ssr: {
            // AWS SDK를 서버 번들에 포함 (프로덕션 배포 시 node_modules 불필요)
            noExternal: ['@aws-sdk/**', '@smithy/**']
        },
        resolve: {
            alias: {
                $themes: path.resolve(__dirname, '../../themes'),
                $widgets: path.resolve(__dirname, '../../widgets'),
                '$custom-widgets': path.resolve(__dirname, '../../custom-widgets')
            }
        },
        preview: {
            port,
            allowedHosts
        },
        server: {
            port,
            allowedHosts,
            // 캐시 헤더는 nginx에서 일괄 관리 (중복 방지)
            hmr: env.VITE_HMR_HOST
                ? {
                      host: env.VITE_HMR_HOST,
                      protocol: env.VITE_HMR_PROTOCOL || 'wss',
                      clientPort: parseInt(env.VITE_HMR_CLIENT_PORT || '443')
                  }
                : true,
            fs: {
                allow: ['.', '../..', '../../..']
            },
            proxy: {
                // /api/v1/* 프록시 제거됨 - SvelteKit 라우트에서 처리
                // routes/api/v1/[...path]/+server.ts가 모든 /api/v1/* 요청을 백엔드로 프록시
                // 이렇게 하면 SSR 인증 토큰이 항상 주입됨 (admin 포함)

                // /api/v2만 직접 프록시 (SSR 인증 불필요한 경우)
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
