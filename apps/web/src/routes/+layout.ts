import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';

// SSR 활성화 (Node.js adapter 사용 시)
// 개발 환경에서 CSR 필요 시 VITE_SSR=false로 설정
export const ssr = import.meta.env.VITE_SSR !== 'false';
export const prerender = false;

/**
 * SPA 네비게이션 시 레이아웃 데이터 참조 안정화
 *
 * 서버에서 매번 동일한 레이아웃 데이터(theme, plugins, menus 등)를 보내도,
 * JSON 직렬화/역직렬화로 매번 새 객체가 생성됨 → SvelteKit이 "변경됨"으로 판단 → 하위 컴포넌트 불필요 업데이트.
 *
 * 이 universal load에서 stable keys의 JSON이 동일하면 이전 참조를 재사용하여
 * SvelteKit의 shallow comparison을 통과, 하위 업데이트를 스킵함.
 */

// 자주 변경되지 않는 레이아웃 데이터 키 (SPA 네비게이션 사이 동일)
const STABLE_KEYS = [
    'activeTheme',
    'themeSettings',
    'activePlugins',
    'menus',
    'celebration',
    'banners',
    'ga4MeasurementId'
] as const;

// 클라이언트 전용 캐시 (서버에서는 요청간 공유되므로 사용하지 않음)
let cachedResult: Record<string, unknown> | null = null;
let cachedHashes: Record<string, string> = {};

export const load: LayoutLoad = async ({ data }) => {
    // 서버에서는 캐싱 없이 그대로 반환
    if (!browser) return data;

    // 클라이언트: stable keys 비교
    if (cachedResult) {
        let allSame = true;
        for (const key of STABLE_KEYS) {
            const hash = JSON.stringify(data[key]);
            if (hash !== cachedHashes[key]) {
                allSame = false;
                break;
            }
        }

        if (allSame) {
            // stable 데이터 동일 → 캐시된 참조 재사용 + 사용자 데이터만 갱신
            cachedResult.user = data.user;
            cachedResult.accessToken = data.accessToken;
            cachedResult.csrfToken = data.csrfToken;
            cachedResult.isAdmin = data.isAdmin;
            return cachedResult;
        }
    }

    // 새 데이터: 캐시 갱신
    cachedResult = { ...data };
    cachedHashes = {};
    for (const key of STABLE_KEYS) {
        cachedHashes[key] = JSON.stringify(data[key]);
    }
    return cachedResult;
};
