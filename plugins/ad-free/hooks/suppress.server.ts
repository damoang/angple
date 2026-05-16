/**
 * Server-side register — plugin-server-loader 의 import.meta.glob 가 자동 import.
 * SSR 부팅 시 module load → top-level addFilter 실행 (WP add_filter 동치).
 */
import { hooks } from '@angple/hook-system';
import { suppressAdsForAdFreeMember } from './suppress';

hooks.addFilter('should_render_ad', suppressAdsForAdFreeMember as never, 10);

export { suppressAdsForAdFreeMember };
export type { AdFreeFilterCtx } from './suppress';
