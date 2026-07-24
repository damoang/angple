/**
 * 앙티티 항목별 평점(aspect rating) — type별 고정 프리셋 (단일 소스)
 *
 * 순수 로직만 담는다(DB·SvelteKit 의존 없음) — 서버 라우트·작품 페이지·작성폼이
 * 모두 이 모듈을 읽어 프리셋/라벨/검증을 공유한다.
 *
 * 저장 규약: angple_rating_aspects (bo_table='@entity', wr_id=entity_id,
 * PK 에 aspect 포함 → 회원당 작품당 항목당 1표). 프리셋 화이트리스트 밖 aspect 는
 * 저장 자체를 거부해 자유텍스트 오염을 원천 차단한다.
 *
 * (angple_entities.meta.aspects 오버라이드는 코드만 열어둔 상태 — 운영 UI 후순위.)
 */

/** 프리셋 항목 1개: DB 저장 키(영문) + 표시 라벨(한글) */
export interface AspectDef {
    key: string;
    label: string;
}

const STORY: AspectDef = { key: 'story', label: '스토리' };
const IMMERSION: AspectDef = { key: 'immersion', label: '몰입' };

/** 영화·드라마·애니메이션: 스토리/연출/연기/영상/음악 */
const PRESET_SCREEN: AspectDef[] = [
    STORY,
    { key: 'directing', label: '연출' },
    { key: 'acting', label: '연기' },
    { key: 'visual', label: '영상' },
    { key: 'music', label: '음악' }
];

/** 책: 스토리/문장/몰입 */
const PRESET_BOOK: AspectDef[] = [STORY, { key: 'writing', label: '문장' }, IMMERSION];

/** 웹툰: 스토리/작화/몰입 (책과 같은 구성, 문장 대신 작화) */
const PRESET_WEBTOON: AspectDef[] = [STORY, { key: 'writing', label: '작화' }, IMMERSION];

/** 게임: 스토리/게임성/그래픽/사운드 */
const PRESET_GAME: AspectDef[] = [
    STORY,
    { key: 'gameplay', label: '게임성' },
    { key: 'graphics', label: '그래픽' },
    { key: 'sound', label: '사운드' }
];

/** 그 외 type(공연·전시 등): 스토리/완성도/몰입 */
export const DEFAULT_ASPECTS: AspectDef[] = [
    STORY,
    { key: 'completeness', label: '완성도' },
    IMMERSION
];

/**
 * 맛집·장소(앙지도) 프리셋: 맛/가성비/분위기/친절.
 *
 * 앙티티 프리셋(작품 축)과 완전히 별개 축이다. 게시판(boardId) 단위로 매핑되며
 * (엔티티 type 이 아님), 총점을 남긴 회원에게만 옵트인으로 노출된다.
 */
export const PRESET_PLACE: AspectDef[] = [
    { key: 'taste', label: '맛' },
    { key: 'value', label: '가성비' },
    { key: 'mood', label: '분위기' },
    { key: 'service', label: '친절' }
];

/** 일반 게시판 boardId → 항목 프리셋. 여기 없는 보드는 항목별 평가 미지원(null). */
const PRESETS_BY_BOARD: Record<string, AspectDef[]> = {
    angmap: PRESET_PLACE
};

/**
 * 일반 게시판(boardId) → 항목 프리셋. 매핑에 없으면 null(= 항목별 평가 미지원).
 * 엔티티 type 프리셋(getAspectPreset)과 별개 축 — 절대 섞지 않는다.
 */
export function getBoardAspectPreset(boardId: string): AspectDef[] | null {
    return PRESETS_BY_BOARD[boardId] ?? null;
}

/** entity.type → 프리셋 매핑 (여기 없는 type 은 DEFAULT_ASPECTS) */
const PRESETS_BY_TYPE: Record<string, AspectDef[]> = {
    movie: PRESET_SCREEN,
    drama: PRESET_SCREEN,
    animation: PRESET_SCREEN,
    book: PRESET_BOOK,
    webtoon: PRESET_WEBTOON,
    game: PRESET_GAME
};

/** entity.type(영문 소문자) → 항목 프리셋. 모르는 type 은 default 프리셋. */
export function getAspectPreset(type: string): AspectDef[] {
    return PRESETS_BY_TYPE[type] ?? DEFAULT_ASPECTS;
}

/** aspect 키 → 해당 type 프리셋의 한글 라벨. 프리셋에 없으면 null. */
export function getAspectLabel(type: string, key: string): string | null {
    const def = getAspectPreset(type).find((a) => a.key === key);
    return def ? def.label : null;
}

/** 검증 결과: ok=false 면 error 에 사용자 안내 문구 */
export type AspectValidation =
    | { ok: true; aspects: Record<string, number> }
    | { ok: false; error: string };

/**
 * aspects 입력({story: 4, ...})을 **주어진 프리셋** 화이트리스트로 검증한다(축 불문).
 *
 *  - 프리셋에 있는 키만 수용 — 밖의 키가 하나라도 있으면 전체 거부
 *  - 값은 숫자만, 반올림 후 1~5 범위 밖이면 거부 (4.4 → 4 수용, 5.6 → 거부)
 *  - 부분 입력 허용(프리셋 일부 항목만 보내도 됨), 빈 입력은 거부
 *
 * 엔티티(type)·게시판(boardId) 양쪽 경로가 이 순수 함수를 공유한다.
 */
export function validateAspectsAgainst(preset: AspectDef[], input: unknown): AspectValidation {
    if (input == null || typeof input !== 'object' || Array.isArray(input)) {
        return { ok: false, error: '항목별 평가 형식이 올바르지 않아요.' };
    }
    const allowed = new Set(preset.map((a) => a.key));
    const aspects: Record<string, number> = {};
    for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
        if (!allowed.has(key)) {
            return { ok: false, error: `평가할 수 없는 항목이에요: ${key}` };
        }
        const value = typeof raw === 'number' ? raw : Number(raw);
        const rounded = Math.round(value);
        if (!Number.isFinite(value) || rounded < 1 || rounded > 5) {
            return { ok: false, error: '항목별 별점은 1~5 사이여야 해요.' };
        }
        aspects[key] = rounded;
    }
    if (Object.keys(aspects).length === 0) {
        return { ok: false, error: '평가할 항목이 없어요.' };
    }
    return { ok: true, aspects };
}

/**
 * aspects 입력을 엔티티 type 프리셋으로 검증한다(앙티티 경로 — 기존 호출부 호환).
 */
export function validateAspects(type: string, input: unknown): AspectValidation {
    return validateAspectsAgainst(getAspectPreset(type), input);
}

/**
 * 본문 채점표 템플릿(자유 편집용) HTML.
 *
 * 작성폼의 [채점표 넣기] 버튼이 tiptap 에디터에 삽입한다. 구조화 저장이 아니라
 * 문화 형성용 — 항목 | 점수(10점 만점) | 한줄평 표를 손으로 채우는 스타일
 * (free/6780927 KalqTrapZ님 리뷰 형식).
 */
export function buildScorecardTableHtml(aspects: AspectDef[]): string {
    const rows = aspects.map((a) => `<tr><td>${a.label}</td><td> /10</td><td></td></tr>`).join('');
    return `<table><tbody><tr><th>항목</th><th>점수</th><th>한줄평</th></tr>${rows}</tbody></table>`;
}
