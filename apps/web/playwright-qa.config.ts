import { defineConfig } from '@playwright/test';

/**
 * QA 테스트용 Playwright 설정
 * 개발 서버 (localhost:5173)에서 직접 테스트
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: 'qa-full-test.spec.ts',
	timeout: 60000,
	retries: 0,
	workers: 1, // 순차 실행 (로그인 상태 공유 방지)
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'on',
		video: 'retain-on-failure'
	}
});
