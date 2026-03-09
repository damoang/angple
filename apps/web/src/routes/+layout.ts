/**
 * Universal load — 참조 안정화 (SPA 네비게이션 성능 최적화)
 *
 * SvelteKit의 SPA 네비게이션 시 `__data.json` 역직렬화로 매번 새 객체 참조가 생성됨.
 * Svelte 5의 fine-grained reactivity가 이를 "변경"으로 감지 → 불필요한 $effect 재실행.
 *
 * 이 레이어에서 구조적으로 동일한 데이터는 이전 참조를 재사용하여
 * 세션 내 거의 불변인 데이터(theme, plugins, menus 등)에 의존하는 $effect 실행을 차단.
 */

import { browser } from '$app/environment';

// SSR 활성화 (Node.js adapter 사용 시)
// 개발 환경에서 CSR 필요 시 VITE_SSR=false로 설정
export const ssr = import.meta.env.VITE_SSR !== 'false';
export const prerender = false;

// 이전 데이터 참조 캐시 (클라이언트 전용)
let prev: Record<string, unknown> = {};
let prevFingerprints: Record<string, string> = {};

// 저비용 fingerprint: deep comparison 대신 ID/length 기반 비교
function fingerprint(key: string, value: unknown): string {
    if (value == null) return 'null';
    switch (key) {
        case 'activeTheme':
        case 'ga4MeasurementId':
            return String(value); // primitive — 문자열 비교
        case 'activePlugins':
            return (value as { id: string; version: string }[])
                .map((p) => p.id + '@' + p.version)
                .join(',');
        case 'menus':
            return (value as { id: number }[]).map((m) => m.id).join(',');
        case 'celebration':
            return (value as { id: number }[]).map((c) => c.id).join(',');
        case 'banners':
            return Object.entries(value as Record<string, unknown[]>)
                .map(([k, v]) => k + ':' + v.length)
                .sort()
                .join('|');
        case 'themeSettings':
            return JSON.stringify(value); // 작은 객체, JSON OK
        default:
            return JSON.stringify(value);
    }
}

const STABLE_KEYS = [
    'activeTheme',
    'themeSettings',
    'activePlugins',
    'menus',
    'celebration',
    'banners',
    'ga4MeasurementId'
] as const;

export const load = ({ data }) => {
    if (!browser) return data;

    const result = { ...data };
    for (const key of STABLE_KEYS) {
        if (!(key in data)) continue;
        const fp = fingerprint(key, (data as Record<string, unknown>)[key]);
        if (prevFingerprints[key] === fp && key in prev) {
            (result as Record<string, unknown>)[key] = prev[key]; // 이전 참조 재사용
        }
        prevFingerprints[key] = fp;
        prev[key] = (result as Record<string, unknown>)[key];
    }
    return result;
};
