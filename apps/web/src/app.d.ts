// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { SiteContext } from '$lib/server/site-resolver/index.js';

// DamoangAds 타입 정의
interface DamoangAdsInterface {
    render: (position: string) => void;
    on: (
        event: 'render' | 'empty' | 'click' | 'impression',
        callback: (data: { position: string }) => void
    ) => void;
    off: (event: string, callback?: () => void) => void;
}

declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            user: {
                id?: string;
                nickname?: string;
                level: number;
                as_level?: number;
                mb_certify?: string;
                mb_image?: string;
                mb_image_updated_at?: string;
                advertiser_end_date?: string;
                advertiser_status?: 'ongoing' | 'expired' | 'scheduled' | 'inactive';
            } | null;
            accessToken: string | null;
            /** 서버사이드 세션 ID (angple_sid 쿠키 원본값) */
            sessionId: string | null;
            /** CSRF 토큰 (세션에 연결, double-submit cookie 검증용) */
            csrfToken: string | null;
            /** Phase 1: site-resolver 가 host 기반으로 주입한 site 컨텍스트. miss 시 null (기본 테마 사용). */
            site: SiteContext | null;
        }
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    interface Window {
        DamoangAds?: DamoangAdsInterface;
        adsbygoogle?: object[];
        googletag?: typeof googletag;
        turnstile?: {
            render: (
                element: HTMLElement,
                options: {
                    sitekey: string;
                    theme?: 'light' | 'dark' | 'auto';
                    callback?: (token: string) => void;
                    retry?: 'auto' | 'never';
                    'retry-interval'?: number;
                    'error-callback'?: () => boolean | void;
                }
            ) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
        };
        [key: string]: unknown;
    }
}

export {};
