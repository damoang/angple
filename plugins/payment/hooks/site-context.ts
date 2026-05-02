/**
 * 멀티사이트 site_id 해석.
 *
 * 본 헬퍼는 #1224 (멀티사이트 도메인→테마/SEO DB 매핑) 진행에 따라 교체 예정.
 * 현재는 host → site_id 매핑이 DB에 없으므로 fallback (0 = "기본 사이트") 으로 동작합니다.
 *
 * #1224 가 머지되면 angple_sites 테이블 조회로 교체:
 *   SELECT id FROM angple_sites WHERE domain = ? AND active = 1
 */

const FALLBACK_SITE_ID = 0;

export function resolveSiteId(host: string | undefined | null): number {
    if (!host) return FALLBACK_SITE_ID;
    // TODO(#1224): replace with angple_sites lookup
    return FALLBACK_SITE_ID;
}
