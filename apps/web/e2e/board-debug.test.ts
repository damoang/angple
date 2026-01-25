import { test, expect } from '@playwright/test';

test('API 연결 디버그', async ({ page }) => {
    // 콘솔 로그 캡처
    const logs: string[] = [];
    page.on('console', msg => {
        logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // 네트워크 요청 캡처
    const requests: string[] = [];
    page.on('request', req => {
        if (req.url().includes('/api/')) {
            requests.push(`${req.method()} ${req.url()}`);
        }
    });

    // 네트워크 응답 캡처
    const responses: string[] = [];
    page.on('response', res => {
        if (res.url().includes('/api/')) {
            responses.push(`${res.status()} ${res.url()}`);
        }
    });

    // 메인 페이지 접속
    await page.goto('/');
    await page.waitForTimeout(3000);

    console.log('\n=== API 요청 ===');
    requests.forEach(r => console.log(r));

    console.log('\n=== API 응답 ===');
    responses.forEach(r => console.log(r));

    console.log('\n=== 콘솔 로그 (API 관련) ===');
    logs.filter(l => l.includes('API') || l.includes('fetch') || l.includes('error')).forEach(l => console.log(l));

    // 스크린샷
    await page.screenshot({ path: '/tmp/board-debug.png', fullPage: true });
});
