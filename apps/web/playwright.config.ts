import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;
const port = isCI ? 3000 : 4173;

export default defineConfig({
    webServer: {
        command: isCI
            ? `ORIGIN=http://localhost:${port} PORT=${port} node build`
            : 'pnpm run build && pnpm run preview',
        port,
        timeout: isCI ? 30_000 : 120_000,
        reuseExistingServer: !isCI
    },
    use: {
        baseURL: `http://localhost:${port}`
    },
    testDir: 'e2e'
});
