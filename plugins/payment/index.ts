/**
 * Payment plugin entry point.
 *
 * 매니페스트의 `main` 필드 (plugin.json: "main": "index.ts").
 * 현재는 import side-effect만 노출 — 실제 라우트/DB 등록은 Phase 1 plugin loader가 매니페스트 기반으로 자동 처리.
 */

export { tossProvider } from './providers/toss/index.js';
export { naverProvider } from './providers/naver/index.js';
export { paypalProvider } from './providers/paypal/index.js';
export { getProvider, listProviders } from './providers/registry.js';

export type {
    PaymentProvider,
    PaymentProviderId,
    PaymentOrder,
    ProviderConfig
} from './types/index.js';
