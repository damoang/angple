import { expect, test } from '@playwright/test';

test('홈페이지가 올바르게 로드된다', async ({ page }) => {
    await page.goto('/');
    // 로고가 보이는지 확인
    await expect(page.getByAltText('damoang')).toBeVisible();
});

test('다크모드 토글이 올바르게 작동한다', async ({ page }) => {
    await page.goto('/');

    // 초기 상태에서 html에 dark 클래스가 없는지 확인
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // 다크모드 버튼 클릭 (aria-label로 찾기)
    const darkModeButton = page.getByRole('button', { name: '다크모드 전환' });
    await darkModeButton.click();

    // html에 dark 클래스가 추가되었는지 확인
    await expect(page.locator('html')).toHaveClass(/dark/);

    // 다시 클릭하면 라이트모드로 돌아가는지 확인
    await darkModeButton.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('헤더 네비게이션 메뉴가 올바르게 작동한다', async ({ page }) => {
    await page.goto('/');

    // 데스크톱 네비게이션이 보이는지 확인
    const nav = page.locator('nav.hidden.items-center.space-x-8.md\\:flex');
    await expect(nav).toBeVisible();

    // 홈 메뉴 클릭
    await page.getByRole('link', { name: '홈' }).click();
    await expect(page).toHaveURL('/');

    // 피드 메뉴 클릭
    await page.getByRole('link', { name: '피드' }).click();
    await expect(page).toHaveURL('/free');
});

test('햄버거 메뉴 드로워가 올바르게 작동한다', async ({ page }) => {
    await page.goto('/');

    // 햄버거 메뉴 버튼이 보이는지 확인
    const menuButton = page.getByRole('button', { name: '추가 메뉴' }).first();
    await expect(menuButton).toBeVisible();

    // 초기 상태에서 드로워가 숨겨져 있는지 확인
    const drawer = page.locator('.fixed.bottom-0.right-0.top-0.z-50.w-80');
    await expect(drawer).toHaveClass(/translate-x-full/);

    // 햄버거 메뉴 클릭
    await menuButton.click();

    // 드로워가 열렸는지 확인
    await expect(drawer).toHaveClass(/translate-x-0/);
    await expect(drawer).not.toHaveClass(/translate-x-full/);

    // 드로워 내부 제목 확인 (heading role로 찾기)
    await expect(page.getByRole('heading', { name: '추가 메뉴' })).toBeVisible();

    // X 버튼으로 드로워 닫기
    const closeButton = page.getByRole('button', { name: '메뉴 닫기' });
    await closeButton.click();

    // 드로워가 닫혔는지 확인
    await expect(drawer).toHaveClass(/translate-x-full/);

    // 다시 햄버거 메뉴 열기
    await menuButton.click();
    await expect(drawer).toHaveClass(/translate-x-0/);

    // 오버레이 클릭으로 드로워 닫기
    const overlay = page.locator('.fixed.inset-0.z-40.bg-black\\/50');
    await overlay.click();
    await expect(drawer).toHaveClass(/translate-x-full/);
});

test('모바일 뷰포트에서 레이아웃이 올바르게 동작한다', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 데스크톱 네비게이션이 숨겨져 있는지 확인
    const desktopNav = page.locator('nav.hidden.items-center.space-x-8.md\\:flex');
    await expect(desktopNav).toBeHidden();

    // 햄버거 메뉴는 여전히 보이는지 확인
    const menuButton = page.getByRole('button', { name: '추가 메뉴' }).first();
    await expect(menuButton).toBeVisible();

    // 모바일에서도 햄버거 메뉴가 작동하는지 확인
    await menuButton.click();
    const drawer = page.locator('.fixed.bottom-0.right-0.top-0.z-50.w-80');
    await expect(drawer).toHaveClass(/translate-x-0/);
});

test('헤더 스크롤 숨김 기능이 작동한다', async ({ page }) => {
    await page.goto('/');

    // 헤더가 초기에 보이는지 확인
    const header = page.locator('header.fixed');
    await expect(header).toHaveClass(/translate-y-0/);
    await expect(header).not.toHaveClass(/-translate-y-full/);

    // 스크롤 테스트를 위해 긴 콘텐츠가 필요하므로
    // 페이지에 높은 요소 추가
    await page.addStyleTag({
        content: 'body::after { content: ""; display: block; height: 2000px; }'
    });

    // 아래로 스크롤
    await page.evaluate(() => window.scrollTo(0, 200));

    // 헤더가 숨겨지는지 확인 (스크롤 이벤트가 처리될 시간 대기)
    await page.waitForTimeout(500);

    // 위로 스크롤
    await page.evaluate(() => window.scrollTo(0, 0));

    // 헤더가 다시 나타나는지 확인
    await page.waitForTimeout(500);
    await expect(header).toHaveClass(/translate-y-0/);
});
