import { test, expect } from '@playwright/test';

test('메인 페이지 및 게시판 확인', async ({ page }) => {
    // 1. 메인 페이지 접속
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/board-01-main.png', fullPage: true });
    console.log('1. 메인 페이지 로드 완료');

    // 2. 자유게시판 링크 찾기 및 클릭
    const freeBoard = page.locator('a[href*="free"]').first();
    if (await freeBoard.isVisible()) {
        await freeBoard.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/board-02-free-list.png', fullPage: true });
        console.log('2. 자유게시판 목록 페이지');
    }

    // 3. 게시글 클릭 (첫 번째 게시글)
    const firstPost = page.locator('article a, .post-item a, a[href*="/posts/"]').first();
    if (await firstPost.isVisible()) {
        await firstPost.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/board-03-post-detail.png', fullPage: true });
        console.log('3. 게시글 상세 페이지');
    }

    // 4. 글쓰기 버튼 확인
    await page.goto('/boards/free');
    await page.waitForTimeout(1000);
    const writeButton = page
        .locator('a[href*="write"], button:has-text("글쓰기"), a:has-text("글쓰기")')
        .first();
    if (await writeButton.isVisible()) {
        await writeButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/board-04-write-form.png', fullPage: true });
        console.log('4. 글쓰기 페이지');
    }

    console.log('테스트 완료! /tmp/board-*.png 파일들을 확인하세요.');
});
