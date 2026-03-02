/**
 * Ads 서버 설정
 *
 * 환경변수 ADS_SERVER_URL을 런타임에 읽습니다.
 * SvelteKit의 $env/dynamic/private를 사용하여 빌드 시 하드코딩을 방지합니다.
 */
import { env } from '$env/dynamic/private';

export function getAdsServerUrl(): string {
    return env.ADS_SERVER_URL || 'http://localhost:9090';
}
