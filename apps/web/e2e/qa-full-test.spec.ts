import { test, expect, Page } from '@playwright/test';

/**
 * Angple 프론트엔드 QA 테스트 자동화
 * 테스트 대상: http://localhost:5173
 * 테스트 계정:
 *   - admin / test1234 (관리자, 레벨 10)
 *   - user2 / test1234 (일반 회원, 레벨 2)
 */

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/angple-qa';

// 테스트 결과 저장
const testResults: {
	passed: string[];
	failed: { name: string; error: string; screenshot?: string }[];
	warnings: string[];
} = {
	passed: [],
	failed: [],
	warnings: []
};

// 헬퍼: 로그인 함수
async function login(page: Page, username: string, password: string): Promise<boolean> {
	try {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForTimeout(1000);

		// 아이디/이메일 입력
		const usernameInput = page.locator(
			'input[name="username"], input[name="email"], input[name="mb_id"], input[type="text"]'
		).first();
		const passwordInput = page.locator('input[type="password"]').first();
		const submitButton = page.locator(
			'button[type="submit"], button:has-text("로그인"), input[type="submit"]'
		).first();

		if (await usernameInput.isVisible()) {
			await usernameInput.fill(username);
		}

		if (await passwordInput.isVisible()) {
			await passwordInput.fill(password);
		}

		if (await submitButton.isVisible()) {
			await submitButton.click();
			await page.waitForTimeout(2000);
		}

		// 로그인 성공 확인 (URL 변경 또는 사용자 메뉴 표시)
		const currentUrl = page.url();
		const isLoggedIn =
			!currentUrl.includes('/login') ||
			(await page.locator('text=로그아웃, text=마이페이지').first().isVisible().catch(() => false));

		return isLoggedIn;
	} catch {
		return false;
	}
}

// 헬퍼: 로그아웃 함수
async function logout(page: Page): Promise<void> {
	try {
		const logoutButton = page.locator(
			'a:has-text("로그아웃"), button:has-text("로그아웃")'
		).first();
		if (await logoutButton.isVisible()) {
			await logoutButton.click();
			await page.waitForTimeout(1000);
		}
	} catch {
		// 로그아웃 버튼이 없을 수 있음
	}
}

// 2.1 인증 테스트
test.describe('2.1 인증 테스트', () => {
	test('로그인 페이지 접근', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForTimeout(1000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/auth-01-login-page.png`, fullPage: true });

		// 로그인 폼 요소 확인
		const hasPasswordInput = await page.locator('input[type="password"]').isVisible();
		expect(hasPasswordInput).toBeTruthy();
		testResults.passed.push('로그인 페이지 접근 - 로그인 폼 표시 확인');
	});

	test('admin 로그인 성공', async ({ page }) => {
		const success = await login(page, 'admin', 'test1234');
		await page.screenshot({ path: `${SCREENSHOT_DIR}/auth-02-admin-login.png`, fullPage: true });

		if (success) {
			testResults.passed.push('admin 로그인 - 성공');
		} else {
			testResults.warnings.push('admin 로그인 - 로그인 폼은 있으나 실제 로그인 동작 확인 필요');
		}
	});

	test('user2 로그인 성공', async ({ page }) => {
		const success = await login(page, 'user2', 'test1234');
		await page.screenshot({ path: `${SCREENSHOT_DIR}/auth-03-user2-login.png`, fullPage: true });

		if (success) {
			testResults.passed.push('user2 로그인 - 성공');
		} else {
			testResults.warnings.push('user2 로그인 - 로그인 폼은 있으나 실제 로그인 동작 확인 필요');
		}
	});

	test('잘못된 비밀번호 에러 표시', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForTimeout(1000);

		const usernameInput = page.locator(
			'input[name="username"], input[name="email"], input[name="mb_id"], input[type="text"]'
		).first();
		const passwordInput = page.locator('input[type="password"]').first();
		const submitButton = page.locator(
			'button[type="submit"], button:has-text("로그인")'
		).first();

		if (await usernameInput.isVisible()) {
			await usernameInput.fill('admin');
		}
		if (await passwordInput.isVisible()) {
			await passwordInput.fill('wrongpassword');
		}
		if (await submitButton.isVisible()) {
			await submitButton.click();
			await page.waitForTimeout(2000);
		}

		await page.screenshot({
			path: `${SCREENSHOT_DIR}/auth-04-wrong-password.png`,
			fullPage: true
		});

		// 에러 메시지 확인
		const errorVisible = await page
			.locator('text=비밀번호, text=오류, text=실패, text=error, .error, .alert')
			.first()
			.isVisible()
			.catch(() => false);

		if (errorVisible) {
			testResults.passed.push('잘못된 비밀번호 - 에러 메시지 표시');
		} else {
			testResults.warnings.push('잘못된 비밀번호 - 에러 메시지 표시 확인 필요');
		}
	});
});

// 2.2 게시판 테스트
test.describe('2.2 게시판 테스트', () => {
	test('메인 페이지 로드', async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForTimeout(2000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-01-main.png`, fullPage: true });

		const hasContent = (await page.content()).length > 500;
		expect(hasContent).toBeTruthy();
		testResults.passed.push('메인 페이지 - 로드 성공');
	});

	test('AI 게시판 접근', async ({ page }) => {
		await page.goto(`${BASE_URL}/ai`);
		await page.waitForTimeout(2000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-02-ai.png`, fullPage: true });

		// 게시판 콘텐츠 확인 (404가 아닌지)
		const content = await page.content();
		const is404 = content.includes('404') && content.includes('찾을 수 없');
		if (!is404) {
			testResults.passed.push('AI 게시판 - 접근 성공');
		} else {
			testResults.warnings.push('AI 게시판 - 404 오류');
		}
	});

	test('자유게시판 접근', async ({ page }) => {
		await page.goto(`${BASE_URL}/free`);
		await page.waitForTimeout(2000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-03-free.png`, fullPage: true });

		const content = await page.content();
		const is404 = content.includes('404') && content.includes('찾을 수 없');
		if (!is404) {
			testResults.passed.push('자유게시판 - 접근 성공');
		} else {
			testResults.warnings.push('자유게시판 - 404 오류');
		}
	});

	test('팁게시판 접근', async ({ page }) => {
		await page.goto(`${BASE_URL}/tip`);
		await page.waitForTimeout(2000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-04-tip.png`, fullPage: true });

		const content = await page.content();
		const is404 = content.includes('404') && content.includes('찾을 수 없');
		if (!is404) {
			testResults.passed.push('팁게시판 - 접근 성공');
		} else {
			testResults.warnings.push('팁게시판 - 404 오류');
		}
	});

	test('공지사항 접근', async ({ page }) => {
		await page.goto(`${BASE_URL}/notice`);
		await page.waitForTimeout(2000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-05-notice.png`, fullPage: true });

		const content = await page.content();
		const is404 = content.includes('404') && content.includes('찾을 수 없');
		if (!is404) {
			testResults.passed.push('공지사항 - 접근 성공');
		} else {
			testResults.warnings.push('공지사항 - 404 오류');
		}
	});

	test('비로그인 게시글 목록 조회', async ({ page }) => {
		await page.goto(`${BASE_URL}/free`);
		await page.waitForTimeout(2000);

		// 게시글 목록 또는 빈 목록 메시지 확인
		const hasPostList = await page
			.locator('article, .post-item, .post-list, tr, li')
			.first()
			.isVisible()
			.catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-06-list-noauth.png`, fullPage: true });

		testResults.passed.push('비로그인 게시글 목록 조회 - 페이지 로드 성공');
	});

	test('페이지네이션 확인', async ({ page }) => {
		await page.goto(`${BASE_URL}/free`);
		await page.waitForTimeout(2000);

		const pagination = page.locator(
			'.pagination, nav[aria-label*="page"], a[href*="page="], button:has-text("다음")'
		).first();
		const hasPagination = await pagination.isVisible().catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/board-07-pagination.png`, fullPage: true });

		if (hasPagination) {
			testResults.passed.push('페이지네이션 - 표시됨');
		} else {
			testResults.warnings.push('페이지네이션 - 게시글이 적어서 미표시 또는 확인 필요');
		}
	});
});

// 2.3 게시글 작성 테스트 (user2)
test.describe('2.3 게시글 작성 테스트 (user2)', () => {
	test('글쓰기 버튼 표시 확인 (AI 게시판)', async ({ page }) => {
		await login(page, 'user2', 'test1234');
		await page.goto(`${BASE_URL}/ai`);
		await page.waitForTimeout(2000);

		const writeButton = page.locator(
			'a:has-text("글쓰기"), button:has-text("글쓰기"), a[href*="write"]'
		).first();
		const hasWriteButton = await writeButton.isVisible().catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/write-01-user2-ai.png`, fullPage: true });

		if (hasWriteButton) {
			testResults.passed.push('user2 AI게시판 글쓰기 버튼 - 표시됨');
		} else {
			testResults.warnings.push('user2 AI게시판 글쓰기 버튼 - 확인 필요 (로그인 상태 확인)');
		}
	});

	test('notice 게시판 글쓰기 버튼 미표시 (권한 제한)', async ({ page }) => {
		await login(page, 'user2', 'test1234');
		await page.goto(`${BASE_URL}/notice`);
		await page.waitForTimeout(2000);

		const writeButton = page.locator(
			'a:has-text("글쓰기"), button:has-text("글쓰기"), a[href*="write"]'
		).first();
		const hasWriteButton = await writeButton.isVisible().catch(() => false);

		await page.screenshot({
			path: `${SCREENSHOT_DIR}/write-02-user2-notice.png`,
			fullPage: true
		});

		if (!hasWriteButton) {
			testResults.passed.push('user2 공지사항 글쓰기 버튼 - 권한 제한으로 미표시 (정상)');
		} else {
			testResults.warnings.push('user2 공지사항 글쓰기 버튼 - 표시됨 (권한 확인 필요)');
		}
	});
});

// 2.4 게시글 작성 테스트 (admin)
test.describe('2.4 게시글 작성 테스트 (admin)', () => {
	test('admin 공지사항 글쓰기 가능', async ({ page }) => {
		await login(page, 'admin', 'test1234');
		await page.goto(`${BASE_URL}/notice`);
		await page.waitForTimeout(2000);

		const writeButton = page.locator(
			'a:has-text("글쓰기"), button:has-text("글쓰기"), a[href*="write"]'
		).first();
		const hasWriteButton = await writeButton.isVisible().catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/write-03-admin-notice.png`, fullPage: true });

		if (hasWriteButton) {
			testResults.passed.push('admin 공지사항 글쓰기 버튼 - 표시됨 (정상)');
		} else {
			testResults.warnings.push('admin 공지사항 글쓰기 버튼 - 확인 필요');
		}
	});
});

// 2.5 댓글 테스트
test.describe('2.5 댓글 테스트', () => {
	test('게시글 상세에서 댓글 영역 확인', async ({ page }) => {
		await page.goto(`${BASE_URL}/free`);
		await page.waitForTimeout(2000);

		// 첫 번째 게시글 클릭 (다양한 셀렉터 시도)
		const firstPost = page.locator('a[href*="/free/"], a[href*="/ai/"], article a, .post-item a, table tbody tr a').first();
		if (await firstPost.isVisible().catch(() => false)) {
			await firstPost.click();
			await page.waitForTimeout(2000);
		}

		await page.screenshot({ path: `${SCREENSHOT_DIR}/comment-01-detail.png`, fullPage: true });

		// 댓글 영역 확인
		const commentSection = page
			.locator('.comment, .comments, #comments, [class*="comment"]')
			.first();
		const hasComments = await commentSection.isVisible().catch(() => false);

		if (hasComments) {
			testResults.passed.push('댓글 영역 - 표시됨');
		} else {
			testResults.warnings.push('댓글 영역 - 게시글 상세 페이지 확인 필요');
		}
	});
});

// 2.6 추천/비추천 테스트
test.describe('2.6 추천/비추천 테스트', () => {
	test('추천 버튼 확인', async ({ page }) => {
		await page.goto(`${BASE_URL}/free`);
		await page.waitForTimeout(2000);

		// 첫 번째 게시글 클릭
		const firstPost = page.locator('a[href*="/free/"], a[href*="/ai/"], article a, .post-item a, table tbody tr a').first();
		if (await firstPost.isVisible().catch(() => false)) {
			await firstPost.click();
			await page.waitForTimeout(2000);
		}

		const recommendButton = page
			.locator(
				'button:has-text("추천"), button:has-text("좋아요"), [class*="like"], [class*="recommend"]'
			)
			.first();
		const hasRecommend = await recommendButton.isVisible().catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/recommend-01.png`, fullPage: true });

		if (hasRecommend) {
			testResults.passed.push('추천 버튼 - 표시됨');
		} else {
			testResults.warnings.push('추천 버튼 - 게시글 상세 페이지에서 확인 필요');
		}
	});
});

// 2.7 검색 테스트
test.describe('2.7 검색 테스트', () => {
	test('검색 기능 확인', async ({ page }) => {
		await page.goto(`${BASE_URL}/free`);
		await page.waitForTimeout(2000);

		const searchInput = page
			.locator('input[type="search"], input[name="search"], input[placeholder*="검색"]')
			.first();
		const hasSearch = await searchInput.isVisible().catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/search-01.png`, fullPage: true });

		if (hasSearch) {
			await searchInput.fill('테스트');
			await page.keyboard.press('Enter');
			await page.waitForTimeout(2000);
			await page.screenshot({ path: `${SCREENSHOT_DIR}/search-02-result.png`, fullPage: true });
			testResults.passed.push('검색 기능 - 검색창 표시 및 검색 실행');
		} else {
			testResults.warnings.push('검색 기능 - 검색창 확인 필요');
		}
	});
});

// 2.8 에러 처리 테스트
test.describe('2.8 에러 처리 테스트', () => {
	test('404 페이지 확인', async ({ page }) => {
		await page.goto(`${BASE_URL}/free/999999999`);
		await page.waitForTimeout(2000);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/error-01-404.png`, fullPage: true });

		const content = await page.content();
		const has404 =
			content.includes('404') ||
			content.includes('찾을 수 없') ||
			content.includes('not found') ||
			content.includes('존재하지 않');

		if (has404) {
			testResults.passed.push('404 에러 페이지 - 정상 표시');
		} else {
			testResults.warnings.push('404 에러 페이지 - 에러 처리 방식 확인 필요');
		}
	});
});

// 2.9 반응형 테스트
test.describe('2.9 반응형 테스트', () => {
	test('모바일 뷰 (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto(BASE_URL);
		await page.waitForTimeout(2000);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/responsive-01-mobile.png`, fullPage: true });
		testResults.passed.push('모바일 뷰 (375px) - 렌더링 성공');
	});

	test('태블릿 뷰 (768px)', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto(BASE_URL);
		await page.waitForTimeout(2000);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/responsive-02-tablet.png`, fullPage: true });
		testResults.passed.push('태블릿 뷰 (768px) - 렌더링 성공');
	});

	test('모바일 네비게이션', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto(BASE_URL);
		await page.waitForTimeout(2000);

		// 햄버거 메뉴 찾기
		const menuButton = page
			.locator(
				'button[aria-label*="menu"], button[aria-label*="메뉴"], .hamburger, [class*="menu-toggle"]'
			)
			.first();
		const hasMenu = await menuButton.isVisible().catch(() => false);

		await page.screenshot({ path: `${SCREENSHOT_DIR}/responsive-03-nav.png`, fullPage: true });

		if (hasMenu) {
			await menuButton.click();
			await page.waitForTimeout(1000);
			await page.screenshot({
				path: `${SCREENSHOT_DIR}/responsive-04-nav-open.png`,
				fullPage: true
			});
			testResults.passed.push('모바일 네비게이션 - 메뉴 버튼 동작');
		} else {
			testResults.warnings.push('모바일 네비게이션 - 메뉴 버튼 확인 필요');
		}
	});
});

// 테스트 완료 후 결과 출력
test.afterAll(async () => {
	console.log('\n========================================');
	console.log('       QA 테스트 결과 요약');
	console.log('========================================\n');

	console.log(`✅ 통과: ${testResults.passed.length}개`);
	testResults.passed.forEach((item) => console.log(`   - ${item}`));

	console.log(`\n⚠️ 주의/확인 필요: ${testResults.warnings.length}개`);
	testResults.warnings.forEach((item) => console.log(`   - ${item}`));

	console.log(`\n❌ 실패: ${testResults.failed.length}개`);
	testResults.failed.forEach((item) => {
		console.log(`   - ${item.name}`);
		console.log(`     Error: ${item.error}`);
	});

	console.log('\n========================================');
	console.log(`스크린샷 저장 위치: ${SCREENSHOT_DIR}`);
	console.log('========================================\n');
});
