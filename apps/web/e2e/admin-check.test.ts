import { test, expect } from '@playwright/test';

test('admin dashboard 확인', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000);

    // 스크린샷 저장
    await page.screenshot({ path: '/tmp/admin-dashboard-test.png', fullPage: true });

    // 콘솔 에러 확인
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });

    // 대시보드 텍스트 확인
    const content = await page.content();
    console.log('Page contains 대시보드:', content.includes('대시보드'));
    console.log('Page contains Angple:', content.includes('Angple'));

    if (errors.length > 0) {
        console.log('Console errors:', errors);
    }
});

test('admin themes 확인', async ({ page }) => {
    await page.goto('/admin/themes');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/admin-themes-test.png', fullPage: true });

    const content = await page.content();
    console.log('Page contains 테마:', content.includes('테마'));
});
