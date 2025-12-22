import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(() => {
    return {
        plugins: [tailwindcss(), sveltekit()],
        server: {
            allowedHosts: ['web.damoang.net', 'damoang.dev', 'localhost']
            // proxy는 로컬 개발에서 비활성화 (Mock 데이터 사용)
            // proxy: {
            //     '/api': {
            //         target: env.API_PROXY_TARGET || 'http://localhost:8081',
            //         changeOrigin: true,
            //         secure: false
            //     }
            // }
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
    };
});
