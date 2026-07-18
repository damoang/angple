/**
 * 앙티티 커넥트 — 작품 사전 순수 로직 (Phase 1)
 *
 * 규약: 아무 게시판 글에 태그 「앙티티」(옵트인 스위치) + 작품명 태그가 달리면
 * 작품명 태그를 앙티티 작품 사전과 "정확 일치" 매칭한다 (자유 텍스트 매칭 없음 — 오탐 원천 차단).
 *
 * 이 파일은 서버 의존성(fetch/cache) 없는 순수 함수만 담아 단위 테스트 대상으로 분리한다.
 * (post-rating-logic.ts 분리 관례)
 */

/** 옵트인 스위치 태그 */
export const ANGTT_TAG = '앙티티';

/** 사전 항목: angtt 게시판 작품 글 1건 */
export interface AngttWork {
    /** angtt 게시판 글 번호 (wr_id) — /angtt/{wrId} 링크 대상 */
    wrId: number;
    /** 원본 제목 (표시용) */
    title: string;
    /** 포스터 썸네일 원본 URL (없으면 '') */
    thumbnail: string;
}

/** 정규화 사전: 정규화 제목 → 작품 */
export type AngttDictionary = Map<string, AngttWork>;

/**
 * 작품 제목 정규화: 앞뒤 공백 제거 + 연속 공백 1개화 + 소문자.
 * 태그와 사전 양쪽에 동일 적용 후 정확 일치 비교한다.
 */
export function normalizeWorkTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 태그 배열에 「앙티티」 옵트인 태그가 있는지 (정규화 비교) */
export function hasAngttTag(tags: readonly string[]): boolean {
    const angtt = normalizeWorkTitle(ANGTT_TAG);
    return tags.some((t) => normalizeWorkTitle(t) === angtt);
}

/**
 * angtt 글 목록 → 정규화 사전 생성.
 * 동명 작품(정규화 제목 중복)은 최신 글(wr_id 큰 쪽) 우선.
 */
export function buildDictionary(
    posts: readonly { wrId: number; title: string; thumbnail: string }[]
): AngttDictionary {
    const dict: AngttDictionary = new Map();
    for (const post of posts) {
        const key = normalizeWorkTitle(post.title);
        if (!key) continue;
        const existing = dict.get(key);
        if (existing && existing.wrId >= post.wrId) continue;
        dict.set(key, { wrId: post.wrId, title: post.title.trim(), thumbnail: post.thumbnail });
    }
    return dict;
}

/** 태그 매칭 결과: 일치 작품 / 미등록(유도 카드용 질의) / 후보 태그 없음(null) */
export type TagMatchResult = { work: AngttWork } | { query: string } | null;

/**
 * 태그 목록에서 작품을 찾는다. 「앙티티」 태그 자신은 후보에서 제외.
 *
 * - 첫 번째로 사전과 일치하는 태그 → { work }
 * - 후보 태그는 있으나 일치 없음 → { query: 첫 번째 후보 태그(트림, 원문 유지) }
 * - 「앙티티」 외 태그가 아예 없음 → null (카드 미표시)
 */
export function matchWorkFromTags(tags: readonly string[], dict: AngttDictionary): TagMatchResult {
    const angtt = normalizeWorkTitle(ANGTT_TAG);
    const candidates = tags
        .map((t) => ({ raw: t.trim(), key: normalizeWorkTitle(t) }))
        .filter((c) => c.key && c.key !== angtt);

    if (candidates.length === 0) return null;

    for (const c of candidates) {
        const work = dict.get(c.key);
        if (work) return { work };
    }
    return { query: candidates[0].raw };
}
