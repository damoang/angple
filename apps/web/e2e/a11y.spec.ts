import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * 접근성(a11y) 자동 테스트
 *
 * axe-core를 사용하여 WCAG 2.1 AA 기준 위반 사항을 검출합니다.
 * 심각(critical)과 중대(serious) 위반만 실패로 처리합니다.
 */

const PAGES_TO_TEST = ['/', '/login', '/search'];

for (const pagePath of PAGES_TO_TEST) {
    test(`접근성 검사: ${pagePath}`, async ({ page }) => {
        await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
        // 페이지 렌더링 대기
        await page.waitForTimeout(2000);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .disableRules(['color-contrast']) // TODO: 색상 대비율 개선 후 활성화
            .analyze();

        // critical, serious 위반만 필터링
        const criticalViolations = results.violations.filter((v) =>
            ['critical', 'serious'].includes(v.impact || '')
        );

        if (criticalViolations.length > 0) {
            const summary = criticalViolations
                .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length}건)`)
                .join('\n');
            console.log(`접근성 위반 발견 (${pagePath}):\n${summary}`);
        }

        expect(criticalViolations).toHaveLength(0);
    });
}
