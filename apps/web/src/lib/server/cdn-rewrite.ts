/**
 * 캐시 JSON 등 raw 문자열의 /data/ 이미지 host 를 CDN_URL 로 치환하는 서버 전용 유틸.
 *
 * 배경: Go/PHP 백엔드가 생성하는 cache JSON(index-widgets, recommended, explore 등)에
 * s3/cdn.damoang.net URL 이 박혀 오는데, 이 경로들은 normalizeMediaUrl 을 거치지 않아
 * R2 read cutover(CDN_URL=r2.damoang.net) 후에도 s3 로 빠짐.
 * → readFile 직후 raw 단계에서 host 만 치환한다.
 *
 * multi-tenant: 테넌트별 CDN_URL env 사용. 미설정(기본 s3) 시 no-op.
 */
import { env } from '$env/dynamic/private';

const CDN_BASE = (env.CDN_URL || 'https://s3.damoang.net').replace(/\/$/, '');

/** raw JSON/HTML 문자열의 /data/ 이미지 host 를 CDN_BASE 로 치환. 기본값이면 no-op. */
export function rewriteImageHosts(raw: string): string {
    if (CDN_BASE === 'https://s3.damoang.net') return raw;
    return raw.replace(/https:\/\/(?:s3|cdn)\.damoang\.net\/data\//g, `${CDN_BASE}/data/`);
}
