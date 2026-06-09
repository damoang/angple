/**
 * 테마 관련 공용 상수 (클라이언트/서버 공용)
 */

/**
 * 오픈코어 기본 테마 ID.
 *
 * 신규 설치 및 시드(seed) 시 사용하는 중립(generic) 기본 테마.
 * 운영 사이트의 활성 테마는 DB(`site_settings.active_theme`)에서 읽으므로,
 * 이 상수를 바꿔도 이미 활성 테마가 지정된 기존 사이트에는 영향이 없다.
 *
 * 다모앙 등 특정 사이트 전용 테마(`damoang-*`)는 코어 기본값으로 두지 않는다
 * (open-core hardcode 0 원칙).
 */
export const DEFAULT_THEME = 'minimal-light';
