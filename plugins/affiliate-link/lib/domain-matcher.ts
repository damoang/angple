/**
 * 도메인 매칭 로직
 * PHP MoneyMoang의 AffiliateDomains.php 참조
 */

import type { AffiliatePlatform, PlatformInfo } from './types';

/** 플랫폼별 도메인 정보 */
export const PLATFORM_DOMAINS: Record<AffiliatePlatform, PlatformInfo> = {
    coupang: {
        id: 'coupang',
        name: 'Coupang',
        nameKo: '쿠팡',
        domains: ['coupang.com', 'link.coupang.com', 'coupa.ng'],
        patterns: [/(^|\.)coupang\.com$/, /^link\.coupang\.com$/, /^coupa\.ng$/]
    },
    aliexpress: {
        id: 'aliexpress',
        name: 'AliExpress',
        nameKo: '알리익스프레스',
        domains: [
            'aliexpress.com',
            'ko.aliexpress.com',
            's.click.aliexpress.com',
            'click.aliexpress.com',
            'a.aliexpress.com'
        ],
        patterns: [/(^|\.)aliexpress\.com$/]
    },
    amazon: {
        id: 'amazon',
        name: 'Amazon',
        nameKo: '아마존',
        domains: [
            'amazon.com',
            'amazon.co.jp',
            'amazon.co.uk',
            'amazon.de',
            'amazon.fr',
            'amazon.es',
            'amazon.it',
            'amazon.ca',
            'amazon.com.au',
            'amzn.to',
            'amzn.asia'
        ],
        patterns: [/(^|\.)amazon\.(com|co\.jp|co\.uk|de|fr|es|it|ca|com\.au)$/, /^amzn\.(to|asia)$/]
    },
    kkday: {
        id: 'kkday',
        name: 'KKday',
        nameKo: 'KKday',
        domains: ['kkday.com'],
        patterns: [/(^|\.)kkday\.com$/]
    },
    linkprice: {
        id: 'linkprice',
        name: 'LinkPrice',
        nameKo: '링크프라이스',
        domains: ['click.linkprice.com', 'lase.kr', 'lpweb.kr', 'bestmore.net', 'linkmoa.kr', 'app.ac'],
        patterns: [/^click\.linkprice\.com$/, /^lase\.kr$/, /^lpweb\.kr$/, /^app\.ac$/]
    }
};

/** 링크프라이스 지원 머천트 도메인 */
export const LINKPRICE_MERCHANTS: string[] = [
    // 쇼핑
    'gmarket.co.kr',
    '11st.co.kr',
    'auction.co.kr',
    'ssg.com',
    'emart.ssg.com',
    'shinsegaemall.ssg.com',
    'lotteon.com',
    'lotteimall.com',
    'hmall.com',
    'gsshop.com',
    'cjonstyle.com',
    'wconcept.co.kr',
    'musinsa.com',
    'zigzag.kr',
    'brandi.co.kr',
    '29cm.co.kr',
    'oliveyoung.co.kr',

    // 여행/숙박
    'agoda.com',
    'booking.com',
    'hotels.com',
    'expedia.co.kr',
    'klook.com',
    'myrealtip.com',
    'yanolja.com',
    'nol.yanolja.com',
    'goodchoice.kr',

    // 도서
    'yes24.com',
    'kyobobook.co.kr',
    'aladin.co.kr',
    'ypbooks.co.kr',

    // 식품
    'kurly.com',
    'coupangfresh.com',
    'oasis.co.kr',

    // 패션 해외
    'kr.shein.com',
    'farfetch.com',
    'ssense.com',
    'mytheresa.com',

    // 기타
    'dominos.co.kr',
    'baskinrobbins.co.kr',
    'dyson.co.kr',
    'samsung.com',
    'lg.co.kr',
    // 'apple.com', // LinkPrice 승인거부 — 제외
    'adobe.com',
    'udemy.com',
    'nordvpn.com',
    'expressvpn.com',
    'airalo.com'
];

/**
 * URL 정규화
 * - 스키마가 없으면 https://를 붙여 파싱 가능하게 만든다.
 */
export function normalizeUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (/^\/\//.test(trimmed)) {
        return `https:${trimmed}`;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
        return trimmed;
    }

    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)) {
        return `https://${trimmed}`;
    }

    return null;
}

/**
 * URL에서 호스트 추출 (www. 제거)
 */
export function extractHost(url: string): string | null {
    try {
        const normalized = normalizeUrl(url);
        if (!normalized) return null;
        const parsed = new URL(normalized);
        return parsed.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

/**
 * URL이 특정 플랫폼에 해당하는지 확인
 */
export function matchesPlatform(url: string, platform: AffiliatePlatform): boolean {
    const host = extractHost(url);
    if (!host) return false;

    const info = PLATFORM_DOMAINS[platform];

    // 패턴 매칭
    if (info.patterns) {
        for (const pattern of info.patterns) {
            if (pattern.test(host)) {
                return true;
            }
        }
    }

    // 도메인 매칭
    for (const domain of info.domains) {
        if (host === domain || host.endsWith('.' + domain)) {
            return true;
        }
    }

    return false;
}

/**
 * URL의 플랫폼 감지
 */
export function detectPlatform(url: string): AffiliatePlatform | null {
    const host = extractHost(url);
    if (!host) return null;

    // 1. 직접 플랫폼 매칭 (쿠팡, 알리, 아마존, KKday)
    const directPlatforms: AffiliatePlatform[] = ['coupang', 'aliexpress', 'amazon', 'kkday'];
    for (const platform of directPlatforms) {
        if (matchesPlatform(url, platform)) {
            return platform;
        }
    }

    // 2. 링크프라이스 단축 URL
    if (matchesPlatform(url, 'linkprice')) {
        return 'linkprice';
    }

    // 3. 링크프라이스 머천트 도메인
    for (const merchant of LINKPRICE_MERCHANTS) {
        if (host === merchant || host.endsWith('.' + merchant)) {
            return 'linkprice';
        }
    }

    return null;
}

/**
 * URL이 제휴 대상인지 확인
 */
export function isAffiliateUrl(url: string): boolean {
    return detectPlatform(url) !== null;
}

/**
 * 플랫폼 한글 이름 반환
 */
export function getPlatformNameKo(platform: AffiliatePlatform): string {
    return PLATFORM_DOMAINS[platform]?.nameKo || platform;
}

/**
 * 플랫폼 영문 이름 반환
 */
export function getPlatformName(platform: AffiliatePlatform): string {
    return PLATFORM_DOMAINS[platform]?.name || platform;
}
