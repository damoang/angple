import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_EXTERNAL_BASE_URL ?? 'https://damoang.net';

export default defineConfig({
    testDir: 'e2e/synthetic',
    fullyParallel: false,
    retries: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-synthetic' }]],
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'Mobile Safari',
            use: {
                ...devices['iPhone 13'],
                browserName: 'webkit'
            }
        }
    ]
});
