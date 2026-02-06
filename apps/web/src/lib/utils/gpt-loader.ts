/**
 * Google Publisher Tag (GPT) 스크립트 로더
 * - 싱글톤 패턴으로 중복 로드 방지
 * - Promise 기반 비동기 초기화
 */

import { browser } from '$app/environment';
import type { GoogleTagInterface } from '$lib/types/googletag';

// GPT 스크립트 URL
const GPT_SCRIPT_URL = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

// 로드 상태 관리
let loadPromise: Promise<GoogleTagInterface> | null = null;
let isLoaded = false;

/**
 * GPT 스크립트 로드
 * @returns Promise<GoogleTagInterface> - googletag 객체
 */
export function loadGPT(): Promise<GoogleTagInterface> {
    if (!browser) {
        return Promise.reject(new Error('GPT는 브라우저에서만 로드 가능합니다.'));
    }

    // 이미 로드 완료
    if (isLoaded && window.googletag) {
        return Promise.resolve(window.googletag);
    }

    // 로드 중인 경우 기존 Promise 반환
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = new Promise((resolve, reject) => {
        // googletag 초기화
        window.googletag = window.googletag || ({ cmd: [] } as unknown as GoogleTagInterface);

        // 이미 로드된 스크립트 확인
        const existingScript = document.querySelector(`script[src="${GPT_SCRIPT_URL}"]`);
        if (existingScript) {
            // 스크립트가 있지만 아직 로드 안됨
            window.googletag!.cmd.push(() => {
                isLoaded = true;
                resolve(window.googletag!);
            });
            return;
        }

        // 스크립트 생성 및 로드
        const script = document.createElement('script');
        script.src = GPT_SCRIPT_URL;
        script.async = true;

        script.onload = () => {
            window.googletag!.cmd.push(() => {
                isLoaded = true;
                resolve(window.googletag!);
            });
        };

        script.onerror = () => {
            loadPromise = null;
            reject(new Error('GPT 스크립트 로드 실패'));
        };

        document.head.appendChild(script);
    });

    return loadPromise;
}

/**
 * GPT가 로드되었는지 확인
 */
export function isGPTLoaded(): boolean {
    return isLoaded && !!window.googletag;
}

/**
 * googletag 객체 반환 (이미 로드된 경우만)
 */
export function getGoogleTag(): GoogleTagInterface | null {
    if (!browser || !isLoaded) return null;
    return window.googletag || null;
}

/**
 * GPT 초기화 (pubads 서비스 설정)
 */
export function initializeGPT(
    options: {
        collapseEmptyDivs?: boolean;
        singleRequest?: boolean;
        targeting?: Record<string, string>;
    } = {}
): void {
    if (!browser || !window.googletag) return;

    const { collapseEmptyDivs = true, singleRequest = true, targeting = {} } = options;

    window.googletag.cmd.push(() => {
        const pubads = window.googletag!.pubads();

        // 빈 슬롯 축소
        if (collapseEmptyDivs) {
            pubads.collapseEmptyDivs();
        }

        // 단일 요청 모드 (성능 최적화)
        if (singleRequest) {
            pubads.enableSingleRequest();
        }

        // 타겟팅 설정
        Object.entries(targeting).forEach(([key, value]) => {
            pubads.setTargeting(key, value);
        });

        // 서비스 활성화
        window.googletag!.enableServices();
    });
}

/**
 * 테마 타겟팅 업데이트 (다크모드 등)
 */
export function updateThemeTargeting(theme: 'light' | 'dark'): void {
    if (!browser || !window.googletag) return;

    window.googletag.cmd.push(() => {
        window.googletag!.pubads().setTargeting('theme', theme);
    });
}

/**
 * 모든 슬롯 새로고침
 */
export function refreshAllSlots(): void {
    if (!browser || !window.googletag) return;

    window.googletag.cmd.push(() => {
        window.googletag!.pubads().refresh();
    });
}

/**
 * DNS Prefetch 링크 추가 (성능 최적화)
 */
export function addDnsPrefetch(): void {
    if (!browser) return;

    const domains = [
        'https://securepubads.g.doubleclick.net',
        'https://pagead2.googlesyndication.com',
        'https://tpc.googlesyndication.com'
    ];

    domains.forEach((domain) => {
        if (!document.querySelector(`link[href="${domain}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = domain;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        }
    });
}
