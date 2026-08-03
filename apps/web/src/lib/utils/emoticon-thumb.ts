/**
 * 이모티콘 선택창(피커)의 썸네일 URL 규칙.
 *
 * 컴포넌트와 테스트가 **같은 함수를 import** 한다. 규칙을 테스트에 복붙하면
 * 구현이 바뀌어도 테스트는 영원히 초록이다(2026-08-03 blocked-comment-filter 사고).
 *
 * ## 왜 두 종류인가 (2026-08-04 실측)
 *
 * 선택창은 썸네일을 40px 로 그리는데 `DINKIssTyle` 팩 썸네일 104개가 6.22MB 였다.
 * 원인은 해상도가 아니라 프레임 수다 — 128px 썸네일에 91~197 프레임이 들어 있다.
 * 첫 프레임만 남긴 `_still` 을 쓰면 213KB → 1.7KB (98.8% 감소).
 *
 * 애니메이션은 확대(hover) 할 때만 필요하므로 그때 `_thumb` 으로 바꾼다.
 */

/** `/api/emoticons/list` 가 돌려주는 항목 중 URL 결정에 필요한 부분만. */
export interface EmoticonThumbSource {
    /** 본문에 삽입되는 원본 파일명. 예: `damoang-emo-011.gif` */
    file: string;
    /** 애니메이션 썸네일. 없으면 null */
    thumb?: string | null;
    /** 정지 썸네일(첫 프레임). 없으면 null */
    still?: string | null;
}

const BASE = '/emoticons/';

/**
 * 평소(정지) 상태에서 쓸 URL.
 *
 * `_still` 이 없는 팩(이미 가벼운 onion 등)은 기존과 똑같이 `_thumb` 을 쓴다.
 */
export function stillThumbUrl(item: EmoticonThumbSource): string {
    return BASE + (item.still || item.thumb || item.file);
}

/**
 * 확대(hover) 시 쓸 애니메이션 URL.
 *
 * ⛔ 여기서 `item.file`(원본)을 우선하면 안 된다. 원본은 `DINKIssTyle-ang-004.webp`
 *    처럼 5.7MB 짜리가 있어 지금보다 나빠진다. `_thumb`(평균 60KB)이 먼저다.
 *    `_thumb` 이 없는 항목만 어쩔 수 없이 원본을 쓴다.
 */
export function animatedThumbUrl(item: EmoticonThumbSource): string {
    return BASE + (item.thumb || item.file);
}

/**
 * 확대 시 실제로 바꿔 끼울 필요가 있는가.
 *
 * 정지본과 애니본이 같은 파일이면 요청이 낭비다(브라우저 캐시가 막아주긴 하지만
 * `loading="lazy"` 와 겹치면 불필요한 디코딩이 생긴다).
 */
export function hasSeparateAnimation(item: EmoticonThumbSource): boolean {
    return stillThumbUrl(item) !== animatedThumbUrl(item);
}
