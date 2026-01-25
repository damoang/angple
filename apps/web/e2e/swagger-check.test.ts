import { test, expect } from '@playwright/test';

test('Swagger UI 프록시 확인', async ({ page }) => {
    await page.goto('/swagger/index.html');
    await page.waitForTimeout(2000);

    // 스크린샷 저장
    await page.screenshot({ path: '/tmp/swagger-test.png', fullPage: true });

    // Swagger UI 로드 확인
    const content = await page.content();
    console.log(
        'Page contains Swagger:',
        content.includes('swagger') || content.includes('Swagger')
    );

    // 페이지 타이틀 확인
    const title = await page.title();
    console.log('Page title:', title);
});
