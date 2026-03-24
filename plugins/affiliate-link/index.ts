/**
 * 제휴 링크 플러그인 메인 엔트리
 */

// 타입 내보내기
export type {
    AffiliatePlatform,
    PlatformInfo,
    ConvertRequest,
    ConvertResponse,
    BatchConvertRequest,
    BatchConvertResponse,
    PlatformConverter,
    ConvertContext
} from './lib/types';

// 도메인 매칭
export {
    detectPlatform,
    isAffiliateUrl,
    getPlatformName,
    getPlatformNameKo,
    extractHost,
    matchesPlatform,
    PLATFORM_DOMAINS,
    LINKPRICE_MERCHANTS
} from './lib/domain-matcher';

// API
export {
    convertAffiliateUrl,
    convertAffiliateUrls,
    convertAffiliateLinks
} from './lib/affiliate-api';

// 캐시
export { getFromCache, setSuccessCache, setErrorCache, clearCache, getCacheStats } from './lib/cache';

// 훅 콜백
export { default as affiliateLinkContentFilter } from './hooks/content-filter';
