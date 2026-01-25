import { test, expect } from '@playwright/test';

/**
 * 설치 위저드 E2E 테스트
 */

test.describe('설치 위저드', () => {
    test('Step 1: 사이트 정보 입력 페이지가 표시된다', async ({ page }) => {
        await page.goto('/install');

        // 페이지 타이틀 확인
        await expect(page).toHaveTitle(/Angple 설치/);

        // 주요 요소 확인
        await expect(page.locator('text=사이트 설정')).toBeVisible();
        await expect(page.locator('input[name="siteName"]')).toBeVisible();
        await expect(page.locator('textarea[name="siteDescription"]')).toBeVisible();
        await expect(page.locator('input[name="siteUrl"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('Step 2: 데이터베이스 설정 페이지가 표시된다', async ({ page }) => {
        await page.goto('/install/step-2');

        // 페이지 타이틀 확인
        await expect(page).toHaveTitle(/Angple 설치/);

        // 주요 요소 확인
        await expect(page.locator('text=데이터베이스 설정')).toBeVisible();
        await expect(page.locator('input[name="dbHost"]')).toBeVisible();
        await expect(page.locator('input[name="dbPort"]')).toBeVisible();
        await expect(page.locator('input[name="dbName"]')).toBeVisible();
        await expect(page.locator('input[name="dbUser"]')).toBeVisible();
    });

    test('Step 3: 관리자 계정 설정 페이지가 표시된다', async ({ page }) => {
        await page.goto('/install/step-3');

        // 페이지 타이틀 확인
        await expect(page).toHaveTitle(/Angple 설치/);

        // 주요 요소 확인
        await expect(page.locator('text=관리자 계정 생성')).toBeVisible();
        await expect(page.locator('input[name="adminEmail"]')).toBeVisible();
        await expect(page.locator('input[name="adminName"]')).toBeVisible();
        await expect(page.locator('input[name="adminPassword"]')).toBeVisible();
    });

    test('Step 1 → Step 2 이동이 작동한다', async ({ page }) => {
        await page.goto('/install');

        // 폼 입력
        await page.fill('input[name="siteName"]', 'Test Site');
        await page.fill('textarea[name="siteDescription"]', 'Test Description');
        await page.fill('input[name="siteUrl"]', 'https://test.com');

        // 제출
        await page.click('button[type="submit"]');

        // Step 2로 이동 확인
        await expect(page).toHaveURL(/\/install\/step-2/);
    });

    test('전체 설치 플로우가 작동한다', async ({ page }) => {
        // Step 1: 사이트 정보
        await page.goto('/install');
        await page.fill('input[name="siteName"]', 'Angple Test');
        await page.fill('textarea[name="siteDescription"]', 'E2E 테스트 사이트');
        await page.fill('input[name="siteUrl"]', 'https://angple.test');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/install\/step-2/);

        // Step 2: 데이터베이스 설정
        await page.fill('input[name="dbHost"]', 'localhost');
        await page.fill('input[name="dbPort"]', '3306');
        await page.fill('input[name="dbName"]', 'angple_test');
        await page.fill('input[name="dbUser"]', 'root');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/install\/step-3/);

        // Step 3: 관리자 계정
        await page.fill('input[name="adminEmail"]', 'admin@angple.test');
        await page.fill('input[name="adminName"]', 'Admin');
        await page.fill('input[name="adminPassword"]', 'password123');
        await page.fill('input[name="adminPasswordConfirm"]', 'password123');
        await page.click('button[type="submit"]');

        // 설치 완료 페이지로 이동 확인
        await expect(page).toHaveURL(/\/install\/complete/);
        await expect(page.locator('text=설치 완료!')).toBeVisible();
    });
});
