import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    server: {
        port: 5174,
        allowedHosts: ['admin.damoang.net', 'localhost'],
        proxy: {
            '/api/v2': {
                target: 'http://localhost:8081',
                changeOrigin: true,
                secure: false,
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        proxyReq.setHeader('Origin', 'http://localhost:8081');
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
