/**
 * 앙티티 작품 후보 — 순수 로직 (DB·네트워크 의존 없음, 단위 테스트 대상).
 *
 * angtt 게시판 원글 제목에서 작품명·별칭(원제)·시즌·종류를 뽑고,
 * 기존 작품과의 매칭 키와 작품 페이지 slug 를 만든다.
 *
 * ⛔ 여기서 뽑은 결과는 **pending 후보**를 만드는 데만 쓴다. 활성화는 사람이 한다.
 *    그래서 판단이 애매하면 "후보 없음"(null) 쪽으로 기운다 — 놓친 작품은 관리자가
 *    수동 등록할 수 있지만, 쓰레기 후보가 쌓이면 대기 목록 자체를 아무도 안 본다.
 */
import { normalizeWorkTitle } from './angtt-dictionary-logic';
import { RESERVED as ENTITY_SLUG_RESERVED } from '../../params/entityslug';
import { ENTITY_TYPES, type EntityType } from '../angtt-entity-presets';

/** 후보로 만들 수 있는 작품 종류 */
export type CandidateType = 'movie' | 'drama' | 'variety' | 'documentary' | 'animation';

/** 관리자 화면에서 고를 수 있는 작품 종류인지 */
export function isEntityType(v: unknown): v is EntityType {
    return typeof v === 'string' && (ENTITY_TYPES as readonly string[]).includes(v);
}

/** 제목에서 뽑은 작품 후보 */
export interface TitleCandidate {
    /** 정규 작품명 (표시용 원문 표기) */
    title: string;
    /** 별칭 — 첫 항목은 title, 이어서 원제 등 */
    aliases: string[];
    /** 「시즌N」 에서 뽑은 시즌 번호 (오름차순, 없으면 빈 배열) */
    seasons: number[];
    type: CandidateType;
}

/** 이 카테고리 글은 작품 후보를 만들지 않는다 (제목 접두와 무관) */
const EXCLUDED_CATEGORIES: ReadonlySet<string> = new Set(['음악', '게임', '공지']);

/** 카테고리(ca_name, 소문자) → 종류. 여기 없는 카테고리는 판단 불가 */
const CATEGORY_TYPE: Readonly<Record<string, CandidateType>> = {
    영화: 'movie',
    드라마: 'drama',
    netflix: 'drama',
    넷플릭스: 'drama',
    apple_tv: 'drama',
    'apple tv': 'drama',
    애플tv: 'drama',
    disney: 'drama',
    'disney+': 'drama',
    디즈니: 'drama',
    '디즈니+': 'drama',
    tving: 'drama',
    티빙: 'drama',
    wavve: 'drama',
    웨이브: 'drama',
    쿠팡플레이: 'drama',
    coupang_play: 'drama',
    watcha: 'drama',
    왓챠: 'drama',
    hbo: 'drama',
    prime_video: 'drama',
    예능: 'variety',
    다큐: 'documentary',
    애니: 'animation',
    애니메이션: 'animation'
};

/** 제목 접두어·괄호 표기 → 종류 */
const KEYWORD_TYPE: Readonly<Record<string, CandidateType>> = {
    영화: 'movie',
    드라마: 'drama',
    미드: 'drama',
    영드: 'drama',
    일드: 'drama',
    중드: 'drama',
    한드: 'drama',
    예능: 'variety',
    다큐멘터리: 'documentary',
    다큐: 'documentary',
    애니메이션: 'animation',
    애니: 'animation'
};

const KEYWORDS = '다큐멘터리|애니메이션|드라마|영화|미드|영드|일드|중드|한드|예능|다큐|애니';

/** [영화] 류 괄호 접두 */
const BRACKET_PREFIX_RE = new RegExp(`^\\s*[[(【]\\s*(${KEYWORDS})\\s*[\\])】]\\s*`);
/** 「영화 "…"」·「미드 리처」 류 접두 — 뒤에 공백·따옴표가 와야 한다(「영화관」 은 접두 아님) */
const WORD_PREFIX_RE = new RegExp(`^\\s*(${KEYWORDS})(?=[\\s"“”'‘’「『《<:：]|$)[\\s:：]*`);

const DOUBLE_QUOTE_RE = /["“”]([^"“”]{1,80})["“”]/;
const BRACKET_QUOTE_RE = /[「『《]([^「」『』《》]{1,80})[」』》]/;
const SINGLE_QUOTE_RE = /['‘’]([^'‘’]{1,80})['‘’]/;

/** 따옴표 없는 제목에서 작품명 뒤를 잘라내는 표지 (앞이 공백·괄호·문장부호이거나 붙어 있어도 됨) */
const REVIEW_MARKER_RE =
    /(감상\s*후기|감상\s*완료|감상기|감상평|관람\s*후기|관람기|시청\s*후기|시청\s*완료|후기|리뷰)/;

const HANGUL_RE = /[가-힣]/;
const LATIN_RE = /[a-zA-Z]/;

/** 작품명으로 받아들이는 최대 길이 — 이보다 길면 문장(잡담)으로 본다 */
const MAX_TITLE_LENGTH = 40;

function collapse(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/** 앞뒤 문장부호·구분자 찌꺼기 제거 */
function trimPunct(s: string): string {
    return collapse(s)
        .replace(/^[\s.,~·…:;!\-–—_/|]+/, '')
        .replace(/[\s.,~·…:;\-–—_/|]+$/, '')
        .trim();
}

function categoryType(caName: string): CandidateType | null {
    const key = caName.trim().toLowerCase();
    return CATEGORY_TYPE[key] ?? null;
}

/** 제목 앞의 종류 접두어를 떼고 그 종류를 돌려준다 */
function stripTypePrefix(subject: string): { rest: string; type: CandidateType | null } {
    const bracket = subject.match(BRACKET_PREFIX_RE);
    if (bracket) {
        return { rest: subject.slice(bracket[0].length), type: KEYWORD_TYPE[bracket[1]] ?? null };
    }
    const word = subject.match(WORD_PREFIX_RE);
    if (word) {
        return { rest: subject.slice(word[0].length), type: KEYWORD_TYPE[word[1]] ?? null };
    }
    return { rest: subject, type: null };
}

/** 따옴표류 안의 첫 텍스트 (겹낫표·이중따옴표 우선, 홑따옴표는 그게 없을 때만) */
function firstQuoted(s: string): string | null {
    const hits = [DOUBLE_QUOTE_RE, BRACKET_QUOTE_RE]
        .map((re) => s.match(re))
        .filter((m): m is RegExpMatchArray => m !== null && m.index !== undefined)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (hits.length > 0) return hits[0][1];
    const single = s.match(SINGLE_QUOTE_RE);
    return single ? single[1] : null;
}

/** 따옴표가 없을 때: 「후기·리뷰」 등 표지 앞까지만 작품명으로 본다 */
function cutAtReviewMarker(s: string): string {
    const m = s.match(REVIEW_MARKER_RE);
    if (!m || m.index === undefined) return s;
    return s.slice(0, m.index);
}

interface Refined {
    title: string;
    aliases: string[];
    seasons: number[];
    typeHint: CandidateType | null;
}

/**
 * 스포일러 표기(노스포·스포무·스포일러 유 …) 제거.
 * ⛔ 앞뒤가 글자로 이어지면 다른 단어다(「스포트라이트」 는 영화 제목) — 경계를 확인한다.
 *    (서버 전용 모듈이지만 lookbehind 없이 쓴다 — 앞 경계는 캡처해서 되돌린다)
 */
const SPOILER_RE =
    /(^|[\s,./|·])(?:노스포|스포일러|스포)\s*(?:유|무|있음|없음|주의|o|x)?(?![가-힣a-zA-Z0-9])/gi;

/** 끝에 붙은 연도: 「코코 2017」·「세기말의 사랑 / 2024」·「파일럿 2024.」 */
const TRAILING_YEAR_RE = /[\s,./·~-]*(?:19|20)\d{2}(?:\s*년)?\s*$/;

/** 「후기」 앞에 붙는 수식어: 「전지적 독자 시점 간단 후기」 */
const TRAILING_MODIFIER_RE = /\s+(?:간단|간단한|짧은|짧게|간략|간략한|솔직|솔직한|개인적인|재)$/;

function stripSpoiler(s: string): string {
    return s.replace(SPOILER_RE, '$1 ');
}

/** 끝 연도 제거 — 연도를 떼면 2글자 미만이 되는 제목(영화 「2012」)은 그대로 둔다 */
function stripTrailingYear(s: string): string {
    const next = s.replace(TRAILING_YEAR_RE, '');
    return normalizeWorkTitle(next).length >= 2 ? next : s;
}

/** 별칭 정리 — 스포 표기·끝 연도·문장부호 */
function cleanAlias(s: string): string {
    return trimPunct(stripTrailingYear(trimPunct(stripSpoiler(s))));
}

type WordClass = 'H' | 'L' | 'N' | 'X';

function wordClass(w: string): WordClass {
    const h = HANGUL_RE.test(w);
    const l = LATIN_RE.test(w);
    if (h && l) return 'X';
    if (h) return 'H';
    return l ? 'L' : 'N';
}

/**
 * 「용쟁호투 Enter the Dragon」 처럼 한글 덩어리와 영문 덩어리가 붙어 있으면 나눈다.
 * 덩어리가 정확히 둘이고 영문 쪽이 2단어 이상일 때만(「트랜스포머 ONE」 은 한 제목이다).
 */
function splitMixedRuns(s: string): { title: string; alias: string } | null {
    const words = s.split(' ').filter(Boolean);
    const cls = words.map(wordClass);
    if (cls.includes('X')) return null;
    const first = cls.find((c) => c !== 'N');
    if (!first) return null;
    const switchAt = cls.findIndex((c) => c !== 'N' && c !== first);
    if (switchAt < 0) return null;
    const second = cls[switchAt];
    if (cls.slice(switchAt).some((c) => c !== 'N' && c !== second)) return null;
    const a = words.slice(0, switchAt).join(' ');
    const b = words.slice(switchAt).join(' ');
    const latin = first === 'L' ? a : b;
    const hangul = first === 'L' ? b : a;
    if (latin.split(' ').filter((w) => LATIN_RE.test(w)).length < 2) return null;
    return { title: trimPunct(hangul), alias: trimPunct(latin) };
}

/**
 * 작품명 원문을 다듬는다 — 원제·연도·시즌·구분자·스포 표기 처리.
 */
function refine(raw: string): Refined {
    const aliases: string[] = [];
    const seasons: number[] = [];
    const hangulNotes: string[] = [];
    let typeHint: CandidateType | null = null;
    let s = raw;

    // 1) <원제>·〈원제〉 → 별칭
    s = s.replace(/[<〈]([^<>〈〉]{1,80})[>〉]/g, (_m, inner: string) => {
        aliases.push(inner);
        return ' ';
    });

    // 2) [노스포]·[2004]·[EBS 다큐프라임] 류 대괄호 주석은 버린다
    s = s.replace(/[[【]([^\]】]*)[\]】]/g, ' ');

    // 3) 괄호 병기
    s = s.replace(/[(（]([^()（）]*)[)）]/g, (_m, innerRaw: string) => {
        const inner = collapse(innerRaw);
        if (!inner || /스포/.test(inner)) return ' ';
        // 연도: (2014) · (2018년) · (1994 ~ 2004) · (2026,영화) · (영화, 2026)
        if (/\d{4}/.test(inner) && /^[\d\s~\-–,.년]+$/.test(inner)) return ' ';
        const yearWord =
            inner.match(/^\d{4}\s*[,/·]\s*(.+)$/) ?? inner.match(/^(.+?)\s*[,/·]\s*\d{4}$/);
        if (yearWord) {
            const hint = KEYWORD_TYPE[collapse(yearWord[1])];
            if (hint) typeHint = hint;
            else if (!HANGUL_RE.test(yearWord[1])) aliases.push(yearWord[1]);
            return ' ';
        }
        const kw = KEYWORD_TYPE[inner];
        if (kw) {
            typeHint = kw;
            return ' ';
        }
        const season = inner.match(/^시즌\s*(\d{1,2})$/);
        if (season) {
            seasons.push(Number(season[1]));
            return ' ';
        }
        // 한글이 없는 병기 = 원제(HOPE·SILO·東宮).
        // 한글 병기는 보통 주석(「극장판」)이라 버리되, 제목이 영문뿐이면 한글 제목으로 쓴다.
        if (!HANGUL_RE.test(inner)) aliases.push(inner);
        else if (!LATIN_RE.test(inner)) hangulNotes.push(inner);
        return ' ';
    });
    // 짝이 안 맞는 괄호 찌꺼기: 럭키(LUCKY)) → 럭키
    s = s.replace(/[()（）<>〈〉]/g, ' ');

    // 4) 시즌N → meta.seasons (시즌1·2 를 한 작품으로 묶는다)
    s = s.replace(/\s*(?:시즌|\bseason)\s*(\d{1,2})(?!\d)/gi, (_m, n: string) => {
        seasons.push(Number(n));
        return ' ';
    });
    // 「1,2시즌」 처럼 숫자가 앞에 오는 표기
    s = s.replace(/\s*(\d{1,2}(?:\s*[,&~]\s*\d{1,2})*)\s*시즌/g, (_m, list: string) => {
        for (const n of list.split(/[,&~]/)) seasons.push(Number(n.trim()));
        return ' ';
    });

    // 5) 회차 표기: 「1화-10화」
    s = s.replace(/\s*\d{1,3}\s*화(?:\s*[-~]\s*\d{1,3}\s*화)?/g, ' ');

    // 6) 편 번호 나열: 「콰이어트 플레이스 1,2」 → 시리즈명
    s = s.replace(/\s+\d{1,2}(?:\s*[,&~]\s*\d{1,2})+\s*$/, '');

    // 7) 「/」 구분: 「돌풍/2024/스포무」·「For All Mankind / 포 올 맨카인드」
    //    한글이 든 첫 조각이 작품명, 한글 없는 영문 조각은 별칭, 나머지(연도·스포·배우)는 버린다.
    const slashParts = s
        .split(/\s*\/\s*/)
        .map((p) => trimPunct(stripSpoiler(p)))
        .filter((p) => normalizeWorkTitle(p).length > 0);
    if (slashParts.length > 1) {
        const firstHangul = slashParts.find((p) => HANGUL_RE.test(p) && !LATIN_RE.test(p));
        const head = HANGUL_RE.test(slashParts[0]) ? slashParts[0] : (firstHangul ?? slashParts[0]);
        for (const p of slashParts) {
            if (p !== head && !HANGUL_RE.test(p) && LATIN_RE.test(p)) aliases.push(p);
        }
        s = head;
    }

    // 8) 스포 표기 · 「간단」 류 수식어 · 끝 연도
    s = trimPunct(stripSpoiler(s)).replace(TRAILING_MODIFIER_RE, '');
    s = trimPunct(stripTrailingYear(s));

    // 9) 「한글 - English」 구분 → 한글이 작품명, 반대쪽은 원제 별칭.
    //    양쪽 다 한글이면(스파이더맨 - 브랜드뉴데이) 한 제목이라 그대로 둔다.
    const parts = s.split(/\s+[-–—]\s+/);
    if (parts.length === 2) {
        const [left, right] = parts.map(trimPunct);
        if (HANGUL_RE.test(left) && !HANGUL_RE.test(right) && LATIN_RE.test(right)) {
            s = left;
            aliases.push(right);
        } else if (HANGUL_RE.test(right) && !HANGUL_RE.test(left) && LATIN_RE.test(left)) {
            s = right;
            aliases.push(left);
        }
    }

    // 10) 「용쟁호투 Enter the Dragon」 → 한글 작품명 + 영문 별칭
    const mixed = splitMixedRuns(trimPunct(s));
    if (mixed) {
        s = mixed.title;
        aliases.push(mixed.alias);
    }

    // 11) 제목이 영문뿐인데 한글 병기가 하나 있으면 그게 작품명: 「BAD SISTERS (배드 시스터즈)」
    let title = trimPunct(s);
    if (!HANGUL_RE.test(title) && hangulNotes.length === 1) {
        aliases.push(title);
        title = trimPunct(hangulNotes[0]);
    }

    return {
        title,
        // 글자가 하나도 없는 별칭(「부자(?) 관계」 의 「?」)은 버린다
        aliases: aliases.map(cleanAlias).filter((a) => /\p{L}/u.test(a)),
        seasons,
        typeHint
    };
}

/** 정규화 기준으로 중복을 지운다 (첫 표기 유지) */
export function dedupeNames(names: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
        const name = collapse(raw ?? '');
        const key = normalizeWorkTitle(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
    }
    return out;
}

/**
 * angtt 원글 제목 + 카테고리 → 작품 후보. 후보를 만들 수 없으면 null.
 *
 * 규칙(우선순위 순):
 *  1. 카테고리 음악·게임·공지 → null
 *  2. 앞 「영화/드라마/미드/예능/다큐/애니」 접두 → 종류 판단 후 제거
 *  3. 따옴표류(" " 「」 『』 《》, 없으면 ' ') 안 텍스트가 있으면 그것이 작품명.
 *     없으면 「감상후기/후기/리뷰…」 표지 앞까지가 작품명.
 *     ⛔ < > 는 따옴표로 보지 않는다 — 「소년시절의 너 <Better Days>」 처럼 원제 병기다.
 *  4. (2014)·(2026,영화)·(스포 없음) 제거, 한글 없는 괄호 병기·<원제>·「한글 - English」 의
 *     영문 쪽은 별칭, 「시즌N」 은 seasons 로
 *  5. 물음표가 남거나(잡담·질문), 2글자 미만이거나, 40자 초과(문장)면 null
 *  6. 종류 = 접두 > 괄호 표기 > 카테고리. 셋 다 없으면 null
 */
export function extractTitleCandidate(
    subject: string,
    caName: string | null | undefined
): TitleCandidate | null {
    const category = (caName ?? '').trim();
    if (EXCLUDED_CATEGORIES.has(category)) return null;

    const original = collapse(subject ?? '');
    if (!original) return null;

    const { rest, type: prefixType } = stripTypePrefix(original);
    const quoted = firstQuoted(rest);
    const raw = quoted ?? cutAtReviewMarker(rest);

    const refined = refine(raw);
    const title = refined.title;

    if (/[?？]/.test(title)) return null;
    if (normalizeWorkTitle(title).length < 2) return null;
    if (title.length > MAX_TITLE_LENGTH) return null;

    const type = prefixType ?? refined.typeHint ?? categoryType(category);
    if (!type) return null;

    const seasons = [...new Set(refined.seasons.filter((n) => n > 0))].sort((a, b) => a - b);

    return {
        title,
        aliases: dedupeNames([title, ...refined.aliases]),
        seasons,
        type
    };
}

/* ------------------------------------------------------------------ *
 * slug
 * ------------------------------------------------------------------ */

/** slug 최대 길이 (컬럼 160, 충돌 접미 여유) */
const SLUG_MAX = 150;

/**
 * 작품명 → slug 기본형. 정규화(소문자) → 글자·숫자 외 제거 → 공백은 `-`.
 * ⛔ 순수 숫자 slug 는 /angtt/{wr_id} 게시판 글 URL 과 겹치므로 `-작품` 접미를 붙인다.
 *    entityslug 매처의 예약어(write 등)도 같은 이유로 접미를 붙인다.
 */
export function baseSlug(title: string): string {
    let s = normalizeWorkTitle(title ?? '')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!s) return '';
    s = s.slice(0, SLUG_MAX).replace(/-+$/, '');
    if (/^\d+$/.test(s) || ENTITY_SLUG_RESERVED.has(s)) s = `${s}-작품`;
    return s;
}

/**
 * 충돌을 피한 slug. 이미 쓰인 slug 집합(소문자 비교)을 받아 `-2`, `-3` … 을 붙인다.
 * 만들 수 없으면 null.
 */
export function uniqueSlug(title: string, taken: ReadonlySet<string>): string | null {
    const base = baseSlug(title);
    if (!base) return null;
    const isTaken = (s: string) => taken.has(s.toLowerCase());
    if (!isTaken(base)) return base;
    for (let i = 2; i < 1000; i++) {
        const next = `${base}-${i}`;
        if (!isTaken(next)) return next;
    }
    return null;
}

/** 관리자가 직접 입력한 slug 검증 — 통과하면 null, 아니면 사유 */
export function slugError(slug: string): string | null {
    const s = (slug ?? '').trim();
    if (!s) return 'slug 가 비어 있습니다.';
    if (s.length > 160) return 'slug 는 160자 이하여야 합니다.';
    if (!/^[\p{L}\p{N}-]+$/u.test(s)) return 'slug 에는 글자·숫자·하이픈(-)만 쓸 수 있습니다.';
    if (/^\d+$/.test(s)) return '숫자만으로 된 slug 는 게시판 글 주소와 겹쳐 쓸 수 없습니다.';
    if (ENTITY_SLUG_RESERVED.has(s.toLowerCase())) return '예약된 주소라 쓸 수 없습니다.';
    return null;
}

/* ------------------------------------------------------------------ *
 * 기존 작품 매칭
 * ------------------------------------------------------------------ */

/** 이름 → 매칭 키 (정규화형 + 구분자 주변 공백 제거형). 2글자 미만은 버린다. */
export function matchKeys(names: readonly string[]): string[] {
    const keys = new Set<string>();
    for (const name of names) {
        const key = normalizeWorkTitle(name ?? '');
        if (key.length < 2) continue;
        keys.add(key);
        // 「스파이더맨 - 브랜드뉴데이」 ↔ slug 「스파이더맨-브랜드뉴데이」
        const tight = key.replace(/\s*([-:])\s*/g, '$1');
        if (tight.length >= 2) keys.add(tight);
    }
    return [...keys];
}

/** 매칭 대상 작품 (merged 는 넘기지 않거나 넘겨도 무시된다) */
export interface MatchableEntity {
    id: number;
    slug: string;
    status: string;
    canonicalTitle: string;
    aliases: readonly string[];
}

const STATUS_PRIORITY: Readonly<Record<string, number>> = { active: 0, pending: 1, rejected: 2 };

/**
 * 후보와 같은 작품을 찾는다. 작품명·slug·별칭 어느 것이든 정확 일치(정규화)하면 같은 작품.
 * 여러 개가 걸리면 active > pending > rejected, 같은 상태면 먼저 만든(id 작은) 작품.
 * merged 작품은 대상이 아니다(별칭이 병합 대상 작품에 이미 옮겨져 있다).
 *
 * ⛔ 종류(type)는 보지 않는다 — 같은 이름의 영화·드라마를 각각 후보로 만드는 것보다
 *    한 후보에 묶고 사람이 가르는 쪽이 대기 목록을 덜 어지럽힌다.
 */
export function findMatchingEntity<E extends MatchableEntity>(
    names: readonly string[],
    entities: readonly E[]
): E | null {
    const wanted = new Set(matchKeys(names));
    if (wanted.size === 0) return null;

    let best: E | null = null;
    for (const e of entities) {
        const prio = STATUS_PRIORITY[e.status];
        if (prio === undefined) continue;
        const keys = matchKeys([e.canonicalTitle, e.slug, ...e.aliases]);
        if (!keys.some((k) => wanted.has(k))) continue;
        if (
            !best ||
            prio < (STATUS_PRIORITY[best.status] ?? 9) ||
            (prio === STATUS_PRIORITY[best.status] && e.id < best.id)
        ) {
            best = e;
        }
    }
    return best;
}

/* ------------------------------------------------------------------ *
 * meta 헬퍼
 * ------------------------------------------------------------------ */

/** JSON 컬럼 값(이미 파싱됐거나 문자열) → 객체 */
export function asMetaObject(v: unknown): Record<string, unknown> {
    if (v && typeof v === 'object' && !Array.isArray(v))
        return { ...(v as Record<string, unknown>) };
    if (typeof v === 'string') {
        try {
            const parsed = JSON.parse(v);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

/** JSON 컬럼 값 → 문자열 배열 */
export function asStringArray(v: unknown): string[] {
    let value = v;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return [];
        }
    }
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

/** meta.source_posts 등 숫자 배열 읽기 */
export function asIdArray(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    const out: number[] = [];
    for (const x of v) {
        const n = Number(x);
        if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    }
    return out;
}

/**
 * pending 후보의 meta 에 근거 원글·시즌을 더한다.
 * 이미 들어 있어 바뀐 게 없으면 null (UPDATE 생략용).
 */
export function appendSourcePost(
    metaValue: unknown,
    wrId: number,
    seasons: readonly number[] = []
): Record<string, unknown> | null {
    const meta = asMetaObject(metaValue);
    const posts = asIdArray(meta.source_posts);
    const oldSeasons = asIdArray(meta.seasons);
    const mergedSeasons = [...new Set([...oldSeasons, ...seasons])].sort((a, b) => a - b);

    const postAdded = !posts.includes(wrId);
    const seasonAdded = mergedSeasons.length !== oldSeasons.length;
    if (!postAdded && !seasonAdded) return null;

    meta.source_posts = postAdded ? [...posts, wrId] : posts;
    if (mergedSeasons.length > 0) meta.seasons = mergedSeasons;
    return meta;
}

/** 새 후보의 meta */
export function newCandidateMeta(
    candidate: TitleCandidate,
    wrIds: readonly number[],
    caName: string | null | undefined
): Record<string, unknown> {
    const meta: Record<string, unknown> = {
        source: 'angtt_post',
        source_posts: [...new Set(wrIds)]
    };
    if (candidate.seasons.length > 0) meta.seasons = candidate.seasons;
    const ca = (caName ?? '').trim();
    if (ca) meta.ca_name = ca;
    return meta;
}

/** 「한 줄에 하나·쉼표」 입력 → 이름 목록 */
export function parseNameList(input: unknown, max = 50): string[] {
    const list = Array.isArray(input)
        ? input
        : typeof input === 'string'
          ? input.split(/[\n,]/)
          : [];
    return dedupeNames(
        list
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim().slice(0, 100))
            .filter(Boolean)
    ).slice(0, max);
}
