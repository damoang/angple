/**
 * 제휴 링크 플러그인 타입 정의
 */

/** 지원 플랫폼 */
export type AffiliatePlatform = 'coupang' | 'aliexpress' | 'amazon' | 'kkday' | 'linkprice';

/** 플랫폼 정보 */
export interface PlatformInfo {
    id: AffiliatePlatform;
    name: string;
    nameKo: string;
    domains: string[];
    patterns?: RegExp[];
}

/** 변환 요청 */
export interface ConvertRequest {
    url: string;
    bo_table?: string;
    wr_id?: number;
}

/** 변환 응답 */
export interface ConvertResponse {
    url: string;
    original: string;
    platform: AffiliatePlatform | null;
    converted: boolean;
    cached: boolean;
    error?: string;
}

/** 일괄 변환 요청 */
export interface BatchConvertRequest {
    urls: string[];
    bo_table?: string;
    wr_id?: number;
}

/** 일괄 변환 응답 */
export interface BatchConvertResponse {
    results: ConvertResponse[];
    stats: {
        total: number;
        converted: number;
        cached: number;
        failed: number;
    };
}

/** 플랫폼 변환기 인터페이스 */
export interface PlatformConverter {
    platform: AffiliatePlatform;
    info: PlatformInfo;

    /** URL이 이 플랫폼에 해당하는지 확인 */
    matches(url: string): boolean;

    /** URL을 제휴 링크로 변환 */
    convert(url: string, context?: ConvertContext): Promise<string | null>;
}

/** 변환 컨텍스트 */
export interface ConvertContext {
    bo_table?: string;
    wr_id?: number;
    mb_no?: number;
}

/** 캐시 항목 */
export interface CacheEntry {
    url: string;
    converted: string;
    platform: AffiliatePlatform;
    timestamp: number;
    ttl: number;
}

/** 환경 변수 설정 */
export interface AffiliateConfig {
    // 쿠팡
    coupangPartnerId: string;
    coupangAccessKey: string;
    coupangSecretKey: string;

    // 알리익스프레스
    aliexpressAccessKey: string;
    aliexpressSecretKey: string;

    // 아마존
    amazonStoreId: string;

    // KKday
    kkdayCid: string;

    // 링크프라이스
    linkpriceAffiliateId: string;

    // 캐시 TTL (초)
    cacheTtl: number;
}
