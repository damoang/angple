/**
 * 결제 가능 여부 판정 (단일 소스).
 *
 * 결제는 코드가 아니라 **DB 설정**으로 열고 닫는다.
 * `payment_provider_configs` 에 해당 사이트의 `active = 1` 행이 하나라도 있으면 결제 가능.
 * PG 심사가 끝나면 설정 1행만 넣으면 되고, 코드 배포는 필요 없다.
 *
 * fail-closed 원칙: 플러그인 미설치·DB 오류 등 판정 불가 상황에서는 **결제를 열지 않는다**.
 * (결제가 잘못 닫히면 불편이지만, 잘못 열리면 사고다.)
 *
 * 코어와 premium 이 이 헬퍼를 함께 쓰므로 라우트가 갈라져도 판정 로직은 갈리지 않는다.
 */

import { loadPluginServerLib } from './plugin-server-loader.js';

/** payment 플러그인 config-store 의 필요한 부분만 (플러그인 타입에 의존하지 않도록 최소 선언) */
interface PaymentConfigStore {
    listSiteProviders: (siteId: number) => Promise<Array<{ active: boolean }>>;
}

/**
 * 멀티사이트 site_id 해석.
 * DB(`angple_sites`)로 해석된 사이트만 numericId 를 가지며, 그 외에는 기본 사이트(0).
 */
function resolveSiteId(locals: App.Locals): number {
    return locals.site?.numericId ?? 0;
}

/**
 * 이 사이트에서 결제(주문 생성)를 진행할 수 있는지.
 * @returns 활성 PG 설정이 하나라도 있으면 true, 그 외에는 항상 false
 */
export async function isPaymentAvailable(locals: App.Locals): Promise<boolean> {
    try {
        const store = await loadPluginServerLib<PaymentConfigStore>('payment', 'config-store');
        // 플러그인 미설치 = 결제 수단 없음
        if (!store?.listSiteProviders) return false;

        const providers = await store.listSiteProviders(resolveSiteId(locals));
        return providers.length > 0;
    } catch (err) {
        console.error('[payment-availability] 판정 실패 — 결제를 닫습니다', err);
        return false;
    }
}
