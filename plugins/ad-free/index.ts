/**
 * Ad-Free Membership Plugin — 메타데이터 진입점.
 *
 * 자동 활성화는 `hooks/suppress.server.ts` 에서 top-level side-effect 로 처리
 * (plugin-server-loader 의 import.meta.glob 패턴 매칭). 이 파일은 plugin metadata
 * 와 향후 admin 수동 활성/비활성 토글용 진입점.
 *
 * payment 플러그인 의존 (네이버페이/PayPal/토스 정기결제). dependencies 는
 * plugin.json 에 선언.
 */
import { hooks } from '@angple/hook-system';
import { suppressAdsForAdFreeMember } from './hooks/suppress.server';

export const meta = {
    id: 'ad-free',
    version: '0.1.0'
} as const;

/** 수동 활성화 (admin UI 의 토글). 자동 활성화는 .server.ts side-effect 가 처리. */
export function activate(): void {
    if (hooks.getHookCount('should_render_ad', 'filter') === 0) {
        hooks.addFilter('should_render_ad', suppressAdsForAdFreeMember as never, 10);
    }
}

/** 비활성화 — admin 에서 플러그인 OFF 시. */
export function deactivate(): void {
    hooks.removeFilter('should_render_ad', suppressAdsForAdFreeMember as never);
}
