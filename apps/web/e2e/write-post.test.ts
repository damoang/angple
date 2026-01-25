import { test, expect } from '@playwright/test';

test('게시글 작성 페이지 테스트', async ({ page }) => {
    // 1. 자유게시판으로 이동
    await page.goto('/boards/free');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/write-01-board-list.png', fullPage: true });
    console.log('1. 자유게시판 목록 페이지');

    // 2. 글쓰기 버튼 찾기 및 클릭
    const writeButton = page.locator('a:has-text("글쓰기"), button:has-text("글쓰기")').first();
    if (await writeButton.isVisible()) {
        console.log('2. 글쓰기 버튼 발견');
        await writeButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/write-02-write-form.png', fullPage: true });
        console.log('3. 글쓰기 폼 페이지');
    } else {
        // URL로 직접 이동 시도
        console.log('2. 글쓰기 버튼 없음, URL로 직접 이동');
        await page.goto('/boards/free/write');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/write-02-write-form.png', fullPage: true });
        console.log('3. 글쓰기 폼 페이지 (직접 이동)');
    }

    // 3. 폼 요소 확인
    const titleInput = page.locator('input[name="title"], input[placeholder*="제목"]').first();
    const contentArea = page.locator('textarea, [contenteditable="true"], .editor').first();

    console.log('4. 폼 요소 확인:');
    console.log('   - 제목 입력란:', await titleInput.isVisible() ? '있음' : '없음');
    console.log('   - 내용 입력란:', await contentArea.isVisible() ? '있음' : '없음');

    // 4. 테스트 데이터 입력 시도
    if (await titleInput.isVisible()) {
        await titleInput.fill('테스트 게시글 제목');
        console.log('5. 제목 입력 완료');
    }

    if (await contentArea.isVisible()) {
        await contentArea.fill('테스트 게시글 내용입니다.');
        console.log('6. 내용 입력 완료');
    }

    await page.screenshot({ path: '/tmp/write-03-filled-form.png', fullPage: true });
    console.log('7. 입력 완료 스크린샷');
});
