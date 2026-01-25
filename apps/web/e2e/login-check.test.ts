import { test, expect } from '@playwright/test';

test('admin login 페이지 확인', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForTimeout(3000);

    // 스크린샷 저장
    await page.screenshot({ path: '/tmp/admin-login-test.png', fullPage: true });

    // 페이지 내용 확인
    const content = await page.content();
    console.log('Page contains Angple:', content.includes('Angple'));
    console.log('Page contains 로그인:', content.includes('로그인'));
    console.log('Page contains 이메일:', content.includes('이메일'));
});
