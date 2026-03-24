/**
 * 제휴 링크 자동 변환 콘텐츠 필터
 * post_content, comment_content 필터에 등록
 *
 * 클라이언트에서 실행되므로 API를 통해 서버에서 변환 수행
 */

interface FilterContext {
    bo_table?: string;
    wr_id?: number;
}

interface ConvertResponse {
    url: string;
    original: string;
    platform: string | null;
    converted: boolean;
    cached: boolean;
    error?: string;
}

// URL 추출 정규식
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

// 제휴 대상 도메인 패턴 (빠른 필터링용)
const AFFILIATE_DOMAINS = [
    'coupang.com',
    'coupa.ng',
    'aliexpress.com',
    'amazon.com',
    'amazon.co.jp',
    'amazon.co.uk',
    'amazon.de',
    'amazon.fr',
    'amzn.to',
    'amzn.asia',
    'kkday.com',
    'linkprice.com',
    'lase.kr',
    'lpweb.kr',
    'app.ac',
    // 링크프라이스 머천트
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

/**
 * URL이 제휴 대상인지 빠르게 확인
 */
function isAffiliateCandidate(url: string): boolean {
    const urlLower = url.toLowerCase();
    return AFFILIATE_DOMAINS.some((domain) => urlLower.includes(domain));
}

/**
 * 단일 URL 변환 (API 호출)
 */
async function convertUrl(
    url: string,
    boTable?: string,
    wrId?: number
): Promise<ConvertResponse | null> {
    try {
        const response = await fetch('/api/affiliate/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, bo_table: boTable, wr_id: wrId })
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[AffiliateLink] URL 변환 실패:', url, error);
        return null;
    }
}

/**
 * 게시글/댓글 본문에서 링크를 제휴 링크로 변환하는 필터 콜백
 *
 * @param content - 본문 HTML
 * @param context - 게시판, 글 ID 등 컨텍스트
 * @returns 제휴 링크가 적용된 HTML
 */
export default async function affiliateLinkContentFilter(
    content: string,
    context?: FilterContext
): Promise<string> {
    if (!content) return content;

    try {
        // URL 추출
        const urls = content.match(URL_REGEX);
        if (!urls || urls.length === 0) {
            return content;
        }

        // 제휴 대상 URL만 필터링
        const affiliateUrls = [...new Set(urls.filter(isAffiliateCandidate))];
        if (affiliateUrls.length === 0) {
            return content;
        }

        // 병렬로 URL 변환
        const conversions = await Promise.all(
            affiliateUrls.map((url) => convertUrl(url, context?.bo_table, context?.wr_id))
        );

        // 변환 맵 생성
        const urlMap = new Map<string, string>();
        for (let i = 0; i < affiliateUrls.length; i++) {
            const result = conversions[i];
            if (result?.converted && result.url !== result.original) {
                urlMap.set(affiliateUrls[i], result.url);
            }
        }

        // 콘텐츠 내 URL 치환
        if (urlMap.size === 0) {
            return content;
        }

        let result = content;
        for (const [original, converted] of urlMap) {
            // href 속성 내 URL 치환
            result = result.replace(
                new RegExp(`(href=["'])${escapeRegExp(original)}(["'])`, 'g'),
                `$1${converted}$2`
            );
            // 텍스트 노드 내 URL은 유지 (사용자가 입력한 텍스트)
        }

        return result;
    } catch (error) {
        console.error('[AffiliateLink] 콘텐츠 필터 오류:', error);
        return content;
    }
}

/**
 * 정규식 특수문자 이스케이프
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
