/**
 * 제휴 링크 단일 변환 API
 * POST /api/affiliate/convert
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHmac, createHash } from 'crypto';
import { env } from '$env/dynamic/private';

// 환경 변수 (런타임)
const AFFI_COUPANG_ACCESS_KEY = env.AFFI_COUPANG_ACCESS_KEY || '';
const AFFI_COUPANG_SECRET_KEY = env.AFFI_COUPANG_SECRET_KEY || '';
const AFFI_ALIEXPRESS_ACCESS_KEY = env.AFFI_ALIEXPRESS_ACCESS_KEY || '';
const AFFI_ALIEXPRESS_SECRET_KEY = env.AFFI_ALIEXPRESS_SECRET_KEY || '';
const AFFI_AMAZON_STORE_ID = env.AFFI_AMAZON_STORE_ID || 'damoang0c-20';
const AFFI_KKDAY_CID = env.AFFI_KKDAY_CID || '20907';
const AFFI_AFFILIATE_ID = env.AFFI_AFFILIATE_ID || '';

type AffiliatePlatform = 'coupang' | 'aliexpress' | 'amazon' | 'kkday' | 'linkprice';

interface ConvertRequest {
    url: string;
    bo_table?: string;
    wr_id?: number;
}

interface ConvertResponse {
    url: string;
    original: string;
    platform: AffiliatePlatform | null;
    converted: boolean;
    cached: boolean;
    error?: string;
}

// 메모리 캐시
const cache = new Map<string, { url: string; platform: AffiliatePlatform; timestamp: number }>();
const errorCache = new Map<string, number>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일
const ERROR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

function getCacheKey(url: string): string {
    return createHash('md5').update(url).digest('hex');
}

// 플랫폼 도메인 패턴
const PLATFORM_PATTERNS: Record<AffiliatePlatform, RegExp[]> = {
    coupang: [/(^|\.)coupang\.com$/, /^link\.coupang\.com$/, /^coupa\.ng$/],
    aliexpress: [/(^|\.)aliexpress\.com$/],
    amazon: [/(^|\.)amazon\.(com|co\.jp|co\.uk|de|fr|es|it|ca|com\.au)$/, /^amzn\.(to|asia)$/],
    kkday: [/(^|\.)kkday\.com$/],
    linkprice: [/^click\.linkprice\.com$/, /^lase\.kr$/, /^lpweb\.kr$/, /^app\.ac$/]
};

// 링크프라이스 머천트
const LINKPRICE_MERCHANTS = [
    'gmarket.co.kr',
    '11st.co.kr',
    'auction.co.kr',
    'ssg.com',
    'lotteon.com',
    'hmall.com',
    'gsshop.com',
    'cjonstyle.com',
    'wconcept.co.kr',
    'musinsa.com',
    'zigzag.kr',
    'agoda.com',
    'booking.com',
    'hotels.com',
    'expedia.co.kr',
    'klook.com',
    'yanolja.com',
    'yes24.com',
    'kyobobook.co.kr',
    'kurly.com',
    'oliveyoung.co.kr'
];

function extractHost(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

function detectPlatform(url: string): AffiliatePlatform | null {
    const host = extractHost(url);
    if (!host) return null;

    // 직접 플랫폼 매칭
    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS) as [
        AffiliatePlatform,
        RegExp[]
    ][]) {
        for (const pattern of patterns) {
            if (pattern.test(host)) {
                return platform;
            }
        }
    }

    // 링크프라이스 머천트
    for (const merchant of LINKPRICE_MERCHANTS) {
        if (host === merchant || host.endsWith('.' + merchant)) {
            return 'linkprice';
        }
    }

    return null;
}

// 쿠팡 API 호출
async function convertCoupang(url: string): Promise<string | null> {
    if (!AFFI_COUPANG_ACCESS_KEY || !AFFI_COUPANG_SECRET_KEY) return null;

    const now = new Date();
    const datetime =
        now.getUTCFullYear().toString().slice(2) +
        String(now.getUTCMonth() + 1).padStart(2, '0') +
        String(now.getUTCDate()).padStart(2, '0') +
        'T' +
        String(now.getUTCHours()).padStart(2, '0') +
        String(now.getUTCMinutes()).padStart(2, '0') +
        String(now.getUTCSeconds()).padStart(2, '0') +
        'Z';

    const method = 'POST';
    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const message = `${datetime}${method}${path}`;
    const signature = createHmac('sha256', AFFI_COUPANG_SECRET_KEY).update(message).digest('hex');

    const authorization = `CEA algorithm=HmacSHA256, access-key=${AFFI_COUPANG_ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;

    try {
        const response = await fetch(`https://api-gateway.coupang.com${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                Authorization: authorization
            },
            body: JSON.stringify({ coupangUrls: [url] })
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.rCode === '0' && data.data?.[0]?.shortenUrl) {
            return data.data[0].shortenUrl;
        }
        return null;
    } catch {
        return null;
    }
}

// 알리익스프레스 API 호출
async function convertAliexpress(url: string): Promise<string | null> {
    if (!AFFI_ALIEXPRESS_ACCESS_KEY || !AFFI_ALIEXPRESS_SECRET_KEY) return null;

    const processedUrl = url.replace('ko.aliexpress.com', 'www.aliexpress.com');
    const timestamp = new Date()
        .toISOString()
        .replace(/\.\d{3}Z$/, '')
        .replace('T', ' ');

    const params: Record<string, string> = {
        method: 'aliexpress.affiliate.link.generate',
        app_key: AFFI_ALIEXPRESS_ACCESS_KEY,
        timestamp,
        format: 'json',
        v: '2.0',
        sign_method: 'sha256',
        source_values: processedUrl,
        promotion_link_type: '2',
        tracking_id: 'damoang'
    };

    // 서명 생성
    const sortedKeys = Object.keys(params).sort();
    let signString = '';
    for (const key of sortedKeys) {
        signString += key + params[key];
    }
    params.sign = createHmac('sha256', AFFI_ALIEXPRESS_SECRET_KEY)
        .update(signString)
        .digest('hex')
        .toUpperCase();

    try {
        const response = await fetch('https://api-sg.aliexpress.com/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: new URLSearchParams(params).toString()
        });

        if (!response.ok) return null;

        const data = await response.json();
        return (
            data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links
                ?.promotion_link?.[0]?.promotion_link || null
        );
    } catch {
        return null;
    }
}

// 아마존 로컬 변환
function convertAmazon(url: string): string | null {
    const storeId = AFFI_AMAZON_STORE_ID || 'damoang0c-20';
    try {
        const parsed = new URL(url.replace(/&amp;/g, '&'));
        parsed.searchParams.delete('tag');
        parsed.searchParams.set('tag', storeId);
        return parsed.toString();
    } catch {
        return null;
    }
}

// KKday 로컬 변환
function convertKKday(url: string): string | null {
    const cid = AFFI_KKDAY_CID || '20907';
    try {
        const parsed = new URL(url.replace(/&amp;/g, '&'));
        parsed.searchParams.delete('cid');
        parsed.searchParams.set('cid', cid);
        return parsed.toString();
    } catch {
        return null;
    }
}

// 링크프라이스 API 호출
async function convertLinkprice(
    url: string,
    boTable?: string,
    wrId?: number
): Promise<string | null> {
    if (!AFFI_AFFILIATE_ID) return null;

    const clickId = boTable && wrId ? `${boTable}_${wrId}` : 'direct';
    const apiUrl = `https://api.linkprice.com/ci/service/custom_link_xml?a_id=${AFFI_AFFILIATE_ID}&url=${encodeURIComponent(url)}&u_id=${clickId}&mode=json`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.result === 'S' && data.url) {
            let linkpriceUrl = data.url;
            if (!linkpriceUrl.includes('&u=') && !linkpriceUrl.includes('?u=')) {
                const separator = linkpriceUrl.includes('?') ? '&' : '?';
                linkpriceUrl += `${separator}u=${encodeURIComponent(clickId)}`;
            }
            return linkpriceUrl;
        }
        return null;
    } catch {
        return null;
    }
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body: ConvertRequest = await request.json();
        const { url, bo_table, wr_id } = body;

        if (!url) {
            return json({ error: 'URL is required' }, { status: 400 });
        }

        // 플랫폼 감지
        const platform = detectPlatform(url);
        if (!platform) {
            return json({
                url,
                original: url,
                platform: null,
                converted: false,
                cached: false
            } satisfies ConvertResponse);
        }

        // 캐시 확인
        const cacheKey = getCacheKey(url);
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return json({
                url: cached.url,
                original: url,
                platform: cached.platform,
                converted: true,
                cached: true
            } satisfies ConvertResponse);
        }

        // 에러 캐시 확인
        const errorTimestamp = errorCache.get(cacheKey);
        if (errorTimestamp && Date.now() - errorTimestamp < ERROR_CACHE_TTL) {
            return json({
                url,
                original: url,
                platform,
                converted: false,
                cached: true,
                error: 'Previously failed'
            } satisfies ConvertResponse);
        }

        // 플랫폼별 변환
        let convertedUrl: string | null = null;
        switch (platform) {
            case 'coupang':
                convertedUrl = await convertCoupang(url);
                break;
            case 'aliexpress':
                convertedUrl = await convertAliexpress(url);
                break;
            case 'amazon':
                convertedUrl = convertAmazon(url);
                break;
            case 'kkday':
                convertedUrl = convertKKday(url);
                break;
            case 'linkprice':
                convertedUrl = await convertLinkprice(url, bo_table, wr_id);
                break;
        }

        if (convertedUrl) {
            // 성공 캐시
            cache.set(cacheKey, { url: convertedUrl, platform, timestamp: Date.now() });
            return json({
                url: convertedUrl,
                original: url,
                platform,
                converted: true,
                cached: false
            } satisfies ConvertResponse);
        } else {
            // 에러 캐시
            errorCache.set(cacheKey, Date.now());
            return json({
                url,
                original: url,
                platform,
                converted: false,
                cached: false,
                error: 'Conversion failed'
            } satisfies ConvertResponse);
        }
    } catch (error) {
        console.error('[Affiliate Convert] Error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
