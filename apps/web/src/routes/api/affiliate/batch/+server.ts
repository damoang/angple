/**
 * 제휴 링크 일괄 변환 API
 * POST /api/affiliate/batch
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

interface ConvertResult {
    original: string;
    converted: string | null;
    platform: AffiliatePlatform | null;
    success: boolean;
    cached: boolean;
}

interface BatchRequest {
    urls: string[];
    bo_table?: string;
    wr_id?: number;
}

interface BatchResponse {
    results: ConvertResult[];
    stats: {
        total: number;
        converted: number;
        cached: number;
        failed: number;
    };
}

// 메모리 캐시 (convert API와 공유)
const cache = new Map<string, { url: string; platform: AffiliatePlatform; timestamp: number }>();
const errorCache = new Map<string, number>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const ERROR_CACHE_TTL = 6 * 60 * 60 * 1000;

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

    for (const merchant of LINKPRICE_MERCHANTS) {
        if (host === merchant || host.endsWith('.' + merchant)) {
            return 'linkprice';
        }
    }

    return null;
}

// 쿠팡 API
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

    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const signature = createHmac('sha256', AFFI_COUPANG_SECRET_KEY)
        .update(`${datetime}POST${path}`)
        .digest('hex');

    try {
        const response = await fetch(`https://api-gateway.coupang.com${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                Authorization: `CEA algorithm=HmacSHA256, access-key=${AFFI_COUPANG_ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`
            },
            body: JSON.stringify({ coupangUrls: [url] })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.rCode === '0' ? data.data?.[0]?.shortenUrl || null : null;
    } catch {
        return null;
    }
}

// 알리익스프레스 API
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

// 링크프라이스 API
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
                linkpriceUrl += `${linkpriceUrl.includes('?') ? '&' : '?'}u=${encodeURIComponent(clickId)}`;
            }
            return linkpriceUrl;
        }
        return null;
    } catch {
        return null;
    }
}

async function convertUrl(url: string, boTable?: string, wrId?: number): Promise<ConvertResult> {
    const platform = detectPlatform(url);
    if (!platform) {
        return { original: url, converted: null, platform: null, success: false, cached: false };
    }

    // 캐시 확인
    const cacheKey = getCacheKey(url);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
            original: url,
            converted: cached.url,
            platform: cached.platform,
            success: true,
            cached: true
        };
    }

    // 에러 캐시 확인
    const errorTimestamp = errorCache.get(cacheKey);
    if (errorTimestamp && Date.now() - errorTimestamp < ERROR_CACHE_TTL) {
        return { original: url, converted: null, platform, success: false, cached: true };
    }

    // 변환
    let converted: string | null = null;
    switch (platform) {
        case 'coupang':
            converted = await convertCoupang(url);
            break;
        case 'aliexpress':
            converted = await convertAliexpress(url);
            break;
        case 'amazon':
            converted = convertAmazon(url);
            break;
        case 'kkday':
            converted = convertKKday(url);
            break;
        case 'linkprice':
            converted = await convertLinkprice(url, boTable, wrId);
            break;
    }

    if (converted) {
        cache.set(cacheKey, { url: converted, platform, timestamp: Date.now() });
        return { original: url, converted, platform, success: true, cached: false };
    } else {
        errorCache.set(cacheKey, Date.now());
        return { original: url, converted: null, platform, success: false, cached: false };
    }
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body: BatchRequest = await request.json();
        const { urls, bo_table, wr_id } = body;

        if (!urls || !Array.isArray(urls)) {
            return json({ error: 'urls array is required' }, { status: 400 });
        }

        // 최대 50개로 제한
        const limitedUrls = urls.slice(0, 50);

        // 병렬 처리 (5개씩)
        const results: ConvertResult[] = [];
        const batchSize = 5;

        for (let i = 0; i < limitedUrls.length; i += batchSize) {
            const batch = limitedUrls.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map((url) => convertUrl(url, bo_table, wr_id))
            );
            results.push(...batchResults);
        }

        // 통계 계산
        let converted = 0;
        let cached = 0;
        let failed = 0;

        for (const result of results) {
            if (result.success) {
                converted++;
                if (result.cached) cached++;
            } else if (result.platform) {
                failed++;
            }
        }

        return json({
            results,
            stats: {
                total: results.length,
                converted,
                cached,
                failed
            }
        } satisfies BatchResponse);
    } catch (error) {
        console.error('[Affiliate Batch] Error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
