import { defineConfig } from '@playwright/test';

export default defineConfig({
    webServer: {
        command: 'npm run preview',
        port: 4173,
        timeout: 30_000,
        reuseExistingServer: !process.env.CI
    },
    testDir: 'e2e'
});
