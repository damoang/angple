import { test, expect } from '@playwright/test';

/**
 * #989 회귀 방지: iOS Safari history 병합 버그.
 *
 * 증상: `/board` → 글을 빠르게 탭 → 곧바로 빠르게 뒤로가기 하면, 목록이 아니라
 * `about:blank`(앱 로드 전 빈 문서)로 이탈. iOS WebKit이 짧은 시간 내 연속 history
 * 쓰기(SvelteKit init `replaceState` → 내비 `pushState`)를 한 틱으로 병합해, pushState가
 * 새 엔트리를 만드는 대신 현재(`/board`) 엔트리를 덮어쓰기 때문.
 *
 * 수정: `src/app.html`에서 `history.pushState`/`replaceState`를 감싸 호출 직후
 * `history.length`를 동기 read → WebKit이 엔트리를 즉시 commit하여 병합을 막는다.
 *
 * 주의: 실제 병합은 iOS Safari(모바일 WebKit) 타이밍 고유 현상이라 desktop 엔진에선
 * 결정적으로 재현되지 않는다. 따라서 1번 테스트(래퍼 설치 여부)가 핵심 회귀 가드이며,
 * 2번은 동작 문서화 + gross regression 감지용이다. iOS/WebKit에서 돌리면 2번이 병합도 잡는다.
 */
test.describe('#989 history merge commit guard', () => {
    test('history.pushState/replaceState are wrapped (commit guard installed)', async ({
        page
    }) => {
        await page.goto('/');
        const isNative = await page.evaluate(() => ({
            push: history.pushState.toString().includes('[native code]'),
            replace: history.replaceState.toString().includes('[native code]')
        }));
        // 래퍼가 제거되면 네이티브로 돌아가 이 단언이 깨진다 → #989 재발 방지.
        expect(isNative.push, 'history.pushState must be wrapped by the #989 commit guard').toBe(
            false
        );
        expect(
            isNative.replace,
            'history.replaceState must be wrapped by the #989 commit guard'
        ).toBe(false);
    });

    test('rapid replaceState→pushState creates distinct entries (no merge)', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(() => {
            const start = history.length;
            // 같은 틱에 연속 history 쓰기 — 병합 버그 조건 재현
            history.replaceState({ m: 989 }, '', location.href);
            history.pushState({ m: 989 }, '', location.pathname + '?e989a');
            history.pushState({ m: 989 }, '', location.pathname + '?e989b');
            return { start, end: history.length };
        });
        // pushState 2회 → 엔트리 2개 추가. 병합되면 증가량이 부족해진다.
        expect(result.end).toBe(result.start + 2);
    });
});
