/**
 * Client-side register — plugin-client-loader 의 import.meta.glob 가 자동 import.
 * 브라우저 부팅 (hooks.client.ts) 시 module load → top-level addFilter 실행.
 * 이로써 CSR hydration 후 reactive 재평가에서도 광고 OFF 가 유지된다.
 */
import { hooks } from '@angple/hook-system';
import { suppressAdsForAdFreeMember } from './suppress';

hooks.addFilter('should_render_ad', suppressAdsForAdFreeMember as never, 10);

export { suppressAdsForAdFreeMember };
export type { AdFreeFilterCtx } from './suppress';
