import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;
const port = isCI ? 3000 : 4173;

export default defineConfig({
    webServer: {
        // CI: SSR 이 실제 DB/Redis/백엔드와 통신하므로 env 명시 필요.
        // - DB_*: ci.yml services.mysql 의 angple_user/pass
        // - BACKEND_URL/INTERNAL_API_URL: ci.yml backend (8081)
        // - REDIS_HOST: ci.yml services.redis 6379
        command: isCI
            ? [
                  'DB_HOST=127.0.0.1',
                  'DB_USER=angple_user',
                  'DB_PASSWORD=angple_pass_2024',
                  'DB_NAME=angple_db',
                  'BACKEND_URL=http://localhost:8081',
                  'INTERNAL_API_URL=http://localhost:8081/api/v2',
                  'REDIS_HOST=127.0.0.1',
                  'REDIS_PORT=6379',
                  `ORIGIN=http://localhost:${port}`,
                  `PORT=${port}`,
                  'ALLOW_INSTALL_ROUTE_FOR_E2E=true',
                  'node build'
              ].join(' ')
            : 'pnpm run build && pnpm run preview',
        port,
        // 환경 setup 시간 고려해 timeout 확대 (30s → 60s)
        timeout: isCI ? 60_000 : 120_000,
        reuseExistingServer: !isCI
    },
    use: {
        baseURL: `http://localhost:${port}`
    },
    testDir: 'e2e',
    testIgnore: ['synthetic/**']
});
