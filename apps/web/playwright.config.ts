import { defineConfig } from '@playwright/test';

export default defineConfig({
    webServer: {
        command: 'pnpm run preview',
        port: 4173,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI
    },
    testDir: 'e2e'
});
