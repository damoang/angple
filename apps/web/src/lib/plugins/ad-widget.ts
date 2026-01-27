/**
 * 광고 위젯 플러그인 초기화
 *
 * angple-backend 배너 API와 연동
 * 이 파일은 다모앙 운영 환경에서만 사용됩니다.
 *
 * 사용법:
 * 1. +layout.svelte에서 import '$lib/plugins/ad-widget'
 * 2. 또는 필요한 페이지에서만 import
 */

import { hooks } from '@angple/hook-system';
import { browser } from '$app/environment';

export interface BannerApiConfig {
    apiUrl: string;
    trackViewUrl: (id: number) => string;
    trackClickUrl: (id: number) => string;
}

// API 베이스 URL (환경변수 또는 기본값)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

/**
 * 플러그인 초기화
 */
export function initAdWidgetPlugin(): void {
    if (!browser) return;

    // banner_api_config 필터 등록
    hooks.addFilter(
        'banner_api_config',
        (_value: null, _args: { position: string }): BannerApiConfig => {
            return {
                apiUrl: `${API_BASE}/api/plugins/banner/list`,
                trackViewUrl: (id: number) => `${API_BASE}/api/plugins/banner/${id}/view`,
                trackClickUrl: (id: number) => `${API_BASE}/api/plugins/banner/${id}/click`
            };
        },
        10
    );

    console.log('✅ [ad-widget] 플러그인 활성화됨 - API:', API_BASE);
}

// 자동 초기화 (import 시 실행)
if (browser) {
    initAdWidgetPlugin();
}
