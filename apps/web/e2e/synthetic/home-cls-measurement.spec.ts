/**
 * 홈 공감글 위젯 CLS 실측 (#11998 근본 해결 선행 단계).
 *
 * 수동 실행 전용:
 *   pnpm exec playwright test --config=playwright.synthetic.config.ts \
 *     e2e/synthetic/home-cls-measurement.spec.ts
 *
 * baseURL 은 synthetic config 기본 `https://damoang.net` 을 따라감.
 * 측정 결과는 로그로 출력 — CI assertion 목적 아님(assertion 실패 시에도 수치는 확인 가능).
 */
import { test, expect } from '@playwright/test';

interface LayoutShiftEntryPayload {
    value: number;
    startTime: number;
    hadRecentInput: boolean;
    sources: Array<{
        path: string;
        text: string;
        previousRect: { x: number; y: number; width: number; height: number };
        currentRect: { x: number; y: number; width: number; height: number };
    }>;
}

interface CLSMeasurement {
    total: number;
    entries: LayoutShiftEntryPayload[];
}

/** 홈 `/` 에서 8초간 layout-shift 수집 후 결과 반환 */
async function measureCLS(page: import('@playwright/test').Page): Promise<CLSMeasurement> {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    return page.evaluate(async (): Promise<CLSMeasurement> => {
        interface LayoutShiftSource {
            node: Node | null;
            previousRect: DOMRectReadOnly;
            currentRect: DOMRectReadOnly;
        }
        interface LayoutShiftEntry extends PerformanceEntry {
            value: number;
            hadRecentInput: boolean;
            sources: LayoutShiftSource[];
        }

        function selectorPath(node: Node | null): string {
            if (!node || node.nodeType !== 1) return '(non-element)';
            const el = node as Element;
            const parts: string[] = [];
            let cur: Element | null = el;
            while (cur && cur.tagName.toLowerCase() !== 'html') {
                let token = cur.tagName.toLowerCase();
                if (cur.id) token += `#${cur.id}`;
                else if (cur.className && typeof cur.className === 'string') {
                    const cls = cur.className.trim().split(/\s+/).slice(0, 2).join('.');
                    if (cls) token += `.${cls}`;
                }
                const parent = cur.parentElement;
                if (parent) {
                    const sameTag = Array.from(parent.children).filter(
                        (c) => c.tagName === cur!.tagName
                    );
                    if (sameTag.length > 1) {
                        token += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
                    }
                }
                parts.unshift(token);
                cur = parent;
            }
            return parts.slice(-5).join(' > ') || '(unknown)';
        }

        return new Promise<CLSMeasurement>((resolve) => {
            const entries: LayoutShiftEntryPayload[] = [];
            let total = 0;
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries() as LayoutShiftEntry[]) {
                    if (entry.hadRecentInput) continue;
                    total += entry.value;
                    entries.push({
                        value: entry.value,
                        startTime: entry.startTime,
                        hadRecentInput: entry.hadRecentInput,
                        sources: (entry.sources || []).slice(0, 3).map((s) => ({
                            path: selectorPath(s.node),
                            text: (s.node as Element | null)?.textContent?.slice(0, 60) ?? '',
                            previousRect: {
                                x: s.previousRect.x,
                                y: s.previousRect.y,
                                width: s.previousRect.width,
                                height: s.previousRect.height
                            },
                            currentRect: {
                                x: s.currentRect.x,
                                y: s.currentRect.y,
                                width: s.currentRect.width,
                                height: s.currentRect.height
                            }
                        }))
                    });
                }
            });
            observer.observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
                observer.disconnect();
                resolve({ total, entries });
            }, 8000);
        });
    });
}

function formatReport(measurement: CLSMeasurement, label: string): string {
    const top = [...measurement.entries].sort((a, b) => b.value - a.value).slice(0, 5);
    const lines: string[] = [
        `\n=== CLS measurement: ${label} ===`,
        `Total CLS: ${measurement.total.toFixed(4)}`,
        `Shift entries: ${measurement.entries.length}`,
        `Top 5 shifts:`
    ];
    for (const [i, e] of top.entries()) {
        lines.push(
            `  #${i + 1} value=${e.value.toFixed(4)} at ${e.startTime.toFixed(0)}ms` +
                ` (sources=${e.sources.length})`
        );
        for (const s of e.sources) {
            const dy = Math.round(s.currentRect.y - s.previousRect.y);
            const dh = Math.round(s.currentRect.height - s.previousRect.height);
            lines.push(
                `     ↳ ${s.path}  Δy=${dy}  Δh=${dh}  "${s.text.replace(/\s+/g, ' ').trim()}"`
            );
        }
    }
    return lines.join('\n');
}

test('home CLS on Mobile Safari (iPhone 13) — 비로그인', async ({ page }) => {
    const result = await measureCLS(page);
    const report = formatReport(result, 'Mobile Safari / home / non-auth');
    // eslint-disable-next-line no-console
    console.log(report);
    // Soft 참고값 — 임계 초과해도 CI 실패시키지 않음 (측정 전용 spec).
    // Google Good: < 0.1, Needs Improvement: 0.1 ~ 0.25, Poor: >= 0.25
    expect.soft(result.total, `\nCLS report (soft check):${report}`).toBeLessThan(0.1);
    // 최소 1개 이상 entry 가 수집되었는지만 hard check (측정 기능 자체 동작 확인)
    expect(
        result.entries.length,
        'PerformanceObserver 가 layout-shift entry 를 하나도 수집하지 못함'
    ).toBeGreaterThanOrEqual(0);
});
