import { expect, test } from '@playwright/test';

test('테마 미선택 시 안내 메시지가 표시된다', async ({ page }) => {
    await page.goto('/');
    // 테마 미선택 시 안내 메시지 확인
    await expect(page.getByText('테마를 선택해주세요')).toBeVisible();
    await expect(page.getByText('관리자 페이지에서 테마를 활성화해주세요')).toBeVisible();
});

test('테마 API가 올바르게 응답한다', async ({ page }) => {
    // 테마 목록 API 테스트
    const themesResponse = await page.request.get('/api/themes');
    expect(themesResponse.ok()).toBeTruthy();
    const themesData = await themesResponse.json();
    expect(themesData.themes).toBeDefined();
    expect(Array.isArray(themesData.themes)).toBeTruthy();
});

test('활성 테마 API가 올바르게 응답한다', async ({ page }) => {
    // 활성 테마 API 테스트 (테마가 없으면 404, 있으면 200)
    const activeResponse = await page.request.get('/api/themes/active');
    const status = activeResponse.status();

    // 200 (테마 있음) 또는 404 (테마 없음) 모두 정상
    expect([200, 404]).toContain(status);

    if (status === 200) {
        const activeData = await activeResponse.json();
        expect(activeData).toHaveProperty('activeTheme');
        expect(activeData).toHaveProperty('themes');
    } else {
        const errorData = await activeResponse.json();
        expect(errorData).toHaveProperty('error');
    }
});

test('테마 정적 파일이 올바르게 서빙된다', async ({ page }) => {
    // 테마 정적 파일 API 테스트 (sample-theme)
    const themeJsonResponse = await page.request.get('/themes/sample-theme/theme.json');
    expect(themeJsonResponse.ok()).toBeTruthy();
    const themeJson = await themeJsonResponse.json();
    expect(themeJson.id).toBe('sample-theme');
    expect(themeJson.name).toBeDefined();
});

test('홈페이지 HTTP 상태가 200이다', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
});

test('health 엔드포인트가 올바르게 응답한다', async ({ page }) => {
    const response = await page.request.get('/health');
    expect(response.ok()).toBeTruthy();
});
