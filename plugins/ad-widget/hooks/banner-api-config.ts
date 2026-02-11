/**
 * 배너 API 설정 Hook
 *
 * banner_api_config 필터를 통해 image-banner 컴포넌트에
 * API 연동 정보를 제공합니다.
 *
 * ads.damoang.net 프록시 (/api/ads/banners)를 사용합니다.
 * 트래킹은 ImageBanner 내부에서 trackingId 기반으로 직접 처리합니다.
 */

export interface BannerApiConfig {
    apiUrl: string;
    trackViewUrl: (id: number) => string;
    trackClickUrl: (id: number) => string;
}

/**
 * 배너 API 설정을 반환하는 필터 콜백
 *
 * @param _value - 기존 값 (null)
 * @param _args - 필터 인자 (position 등)
 * @returns BannerApiConfig 객체
 */
export default function bannerApiConfig(
    _value: null,
    _args: { position: string }
): BannerApiConfig {
    return {
        apiUrl: '/api/ads/banners',
        trackViewUrl: () => '',
        trackClickUrl: () => ''
    };
}
