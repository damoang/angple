import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
    return {
        envDir: path.resolve(__dirname, '../..'),
        plugins: [tailwindcss(), sveltekit()],
        resolve: {
            alias: {
                $themes: path.resolve(__dirname, '../../themes'),
                $widgets: path.resolve(__dirname, '../../widgets'),
                '$custom-widgets': path.resolve(__dirname, '../../custom-widgets')
            }
        },
        server: {
            allowedHosts: ['web.damoang.net', 'damoang.dev', 'localhost'],
            fs: {
                allow: ['.', '../..']
            },
            proxy: {
                '/api/v2': {
                    target: 'http://localhost:8081',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => {
                        // v2 전용 엔드포인트 목록 (이 경로들은 v1으로 rewrite하지 않고 그대로 v2로 전달)
                        const v2OnlyPaths = [
                            '/api/v2/auth/login', // 인증 로그인만 v2 (profile, refresh는 v1)
                            '/api/v2/payments',
                            '/api/v2/saas',
                            '/api/v2/recommendations',
                            '/api/v2/marketplace',
                            '/api/v2/media',
                            '/api/v2/search',
                            '/api/v2/users', // v2 사용자 목록 등
                            '/api/v2/admin/tenants' // 멀티테넌트 관리
                        ];

                        // v2 전용 경로인 경우 rewrite 안 함
                        if (v2OnlyPaths.some((v2Path) => path.startsWith(v2Path))) {
                            return path;
                        }

                        // 그 외(게시판, 인증 등 Core 기능)는 v1으로 rewrite
                        return path.replace('/api/v2', '/api/v1');
                    },
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            proxyReq.setHeader('Origin', 'http://localhost:8081');
                            // 디버깅용 로그
                            // console.log('[Proxy]', req.method, req.url, '->', proxyReq.path);
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
