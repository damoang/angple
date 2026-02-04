/**
 * 배너 API 설정 Hook
 *
 * banner_api_config 필터를 통해 image-banner 컴포넌트에
 * API 연동 정보를 제공합니다.
 *
 * 이 파일은 다모앙 운영 환경에서만 사용됩니다.
 */

export interface BannerApiConfig {
    apiUrl: string;
    trackViewUrl: (id: number) => string;
    trackClickUrl: (id: number) => string;
}

// API 베이스 URL (환경변수 또는 기본값)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

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
        apiUrl: `${API_BASE}/api/plugins/banner/list`,
        trackViewUrl: (id: number) => `${API_BASE}/api/plugins/banner/${id}/view`,
        trackClickUrl: (id: number) => `${API_BASE}/api/plugins/banner/${id}/click`
    };
}
