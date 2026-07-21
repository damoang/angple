/**
 * 앙티티 리뷰 — 작품명 정규화 순수 로직
 *
 * 코어 `$lib/server/angtt-dictionary-logic.ts` 의 normalize/tag 게이트 규약과
 * 동일하게 유지한다(복제). 태그 쪽과 사전 별칭 쪽에 동일 정규화를 적용한 뒤
 * "정확 일치"로만 매칭하여 자유 텍스트 오탐을 원천 차단한다.
 */

/** 옵트인 스위치 태그 */
export const ANGTT_TAG = '앙티티';

/**
 * 작품 제목/별칭 정규화: 앞뒤 공백 제거 + 연속 공백 1개화 + 소문자.
 * angple_entity_aliases.alias_norm 도 동일 규칙으로 생성된 값이라 정확 일치 비교가 성립한다.
 */
export function normalizeWorkTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 태그 배열에 「앙티티」 옵트인 태그가 있는지 (정규화 비교) */
export function hasAngttTag(tags: readonly string[]): boolean {
    const angtt = normalizeWorkTitle(ANGTT_TAG);
    return tags.some((t) => normalizeWorkTitle(t) === angtt);
}
