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
 * 제목에서 작품명 후보 키들을 추출한다.
 *
 * 앙티티 글 제목이 순수 작품명이 아닌 경우가 많아(실례: 영화 "호프(HOPE)" 감상후기..)
 * 전체 제목 외에 따옴표류(" " ' ' 「」 『』 < > 《》) 안 텍스트와 그 괄호 제거
 * 변형을 후보로 추가한다. 매칭(태그 쪽)은 여전히 정확 일치라 오탐 위험은 낮다.
 * 2글자 미만 후보는 흔한 단어 오탐 방지를 위해 제외.
 */
export function extractTitleCandidates(title: string): string[] {
    const candidates = new Set<string>();
    const add = (raw: string) => {
        const key = normalizeWorkTitle(raw);
        if (key.length >= 2) candidates.add(key);
    };

    add(title);

    for (const m of title.matchAll(
        /["“”'‘’「」『』《》<>]([^"“”'‘’「」『』《》<>]{1,60})["“”'‘’「」『』《》<>]/g
    )) {
        const inner = m[1];
        add(inner);
        // 괄호 병기 제거 변형: 호프(HOPE) → 호프
        const noParen = inner.replace(/[(（][^)）]*[)）]/g, '');
        if (noParen !== inner) add(noParen);
    }

    return [...candidates];
}

/**
 * angtt 글 목록 → 정규화 사전 생성.
 * 각 글은 전체 제목 + 따옴표 추출 후보들로 색인된다.
 * 키 중복(동명 작품·후보 충돌)은 최신 글(wr_id 큰 쪽) 우선.
 */
export function buildDictionary(
    posts: readonly { wrId: number; title: string; thumbnail: string }[]
): AngttDictionary {
    const dict: AngttDictionary = new Map();
    for (const post of posts) {
        for (const key of extractTitleCandidates(post.title)) {
            const existing = dict.get(key);
            if (existing && existing.wrId >= post.wrId) continue;
            dict.set(key, {
                wrId: post.wrId,
                title: post.title.trim(),
                thumbnail: post.thumbnail
            });
        }
    }
    return dict;
}

/* ------------------------------------------------------------------ *
 * 제목 스캔 (티어 B) — 제목 안에 작품 별칭이 "단어로" 등장하는지 찾는다.
 *
 * extractTitleCandidates() 는 제목 *전체*(와 따옴표 안쪽)만 후보로 삼기 때문에
 * "영화 호프 감상기" 같은 평범한 제목에서는 「호프」를 찾지 못한다.
 * 여기서는 반대로 별칭을 제목 안에서 부분 검색하되, 아래 규칙으로 오탐을 막는다.
 *
 * ⚠️ 이 스캔 결과는 그 자체로 자동 저장 근거가 되지 않는다.
 *    canAutoLink 가 true 인 경우에만 자동 연결을 허용하고, 나머지는 "제안"으로만 쓴다.
 * ------------------------------------------------------------------ */

/** 별칭 앞뒤에 붙어 있으면 다른 단어의 일부로 보는 문자 */
const WORD_CHAR = /[0-9a-z가-힣]/;

/**
 * 별칭 바로 뒤에 붙을 수 있는 한국어 조사.
 * 한국어는 교착어라 "호프를"처럼 조사가 바로 붙는다. 조사면 같은 단어로 인정하고,
 * 조사가 아니면(예: "동궁전", "호프집") 다른 단어로 보아 거부한다.
 */
const KOREAN_PARTICLES: ReadonlySet<string> = new Set([
    '을',
    '를',
    '이',
    '가',
    '은',
    '는',
    '에',
    '의',
    '도',
    '만',
    '과',
    '와',
    '로',
    '으로',
    '에서',
    '에선',
    '부터',
    '까지',
    '에게',
    '한테',
    '라',
    '이라',
    '랑',
    '이랑',
    '보다',
    '처럼',
    '같이',
    '밖에',
    '조차',
    '마저',
    '뿐',
    '씩',
    '께',
    '께서',
    '이나',
    '나',
    '든'
]);

/** 작품 별칭 1건 */
export interface EntityAlias {
    /** normalizeWorkTitle() 로 정규화된 별칭 */
    aliasNorm: string;
    /** 작품 식별자 */
    entitySlug: string;
    /**
     * 자동 연결(사람 확인 없이 저장) 허용 여부.
     * 일반어와 겹치는 이름(예: 「참교육」)은 반드시 false 로 둔다.
     */
    autoLink: boolean;
    /**
     * autoLink 시 제목에 함께 나와야 하는 문맥어. 비어 있으면 문맥 조건 없음.
     * 예: 「호프」는 생맥주집을 뜻하기도 하므로 영화 문맥어를 요구한다.
     */
    contextTerms?: readonly string[];
}

/** 제목 스캔 결과 */
export interface TitleScanHit {
    entitySlug: string;
    /** 제목에서 실제로 매칭된 별칭(정규화형) */
    alias: string;
    /** 사람 확인 없이 자동 저장해도 되는 신뢰도인지 */
    canAutoLink: boolean;
}

/**
 * 별칭이 pos 위치에서 "독립된 단어"로 등장했는지 검사한다.
 * 앞: 단어 문자면 거부 ("네오동궁" 같은 결합 거부)
 * 뒤: 단어 문자가 아니면 통과. 한글이 이어지면 그 한글 덩어리가 조사일 때만 통과.
 */
function isWordBoundaryMatch(haystack: string, pos: number, len: number): boolean {
    const before = pos > 0 ? haystack[pos - 1] : '';
    if (before && WORD_CHAR.test(before)) return false;

    let j = pos + len;
    if (j >= haystack.length) return true;
    if (!WORD_CHAR.test(haystack[j])) return true;

    // 뒤에 한글이 이어짐 → 조사인지 확인
    let trailing = '';
    while (j < haystack.length && /[가-힣]/.test(haystack[j])) {
        trailing += haystack[j];
        j++;
    }
    if (!trailing) return false; // 숫자/영문이 이어붙음 → 다른 단어
    return KOREAN_PARTICLES.has(trailing);
}

/**
 * 제목에서 작품 별칭을 찾는다. 여러 별칭이 걸리면 **가장 긴 것** 하나만 반환한다.
 * 어떤 별칭도 단어 경계 조건을 만족하지 못하면 null.
 */
export function scanAliasesInTitle(
    title: string,
    aliases: readonly EntityAlias[]
): TitleScanHit | null {
    const norm = normalizeWorkTitle(title);
    if (!norm) return null;

    // 최장일치 우선 — "동궁" 과 "동궁 시즌2" 가 함께 있으면 긴 쪽을 택한다
    const sorted = [...aliases].sort((a, b) => b.aliasNorm.length - a.aliasNorm.length);

    for (const alias of sorted) {
        const key = alias.aliasNorm;
        if (key.length < 2) continue; // 1글자 별칭은 오탐 위험이 커서 스캔 대상 제외

        let from = 0;
        for (;;) {
            const pos = norm.indexOf(key, from);
            if (pos === -1) break;
            if (isWordBoundaryMatch(norm, pos, key.length)) {
                const terms = alias.contextTerms ?? [];
                const contextOk =
                    terms.length === 0 || terms.some((t) => norm.includes(normalizeWorkTitle(t)));
                return {
                    entitySlug: alias.entitySlug,
                    alias: key,
                    canAutoLink: alias.autoLink && contextOk
                };
            }
            from = pos + 1;
        }
    }

    return null;
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
