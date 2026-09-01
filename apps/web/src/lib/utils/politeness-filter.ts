/**
 * 작성 시점 경어체/비속어 넛지 필터 (순수 정규식 · AI/LLM 호출 없음 · 토큰 0).
 *
 * 목적: 글/댓글을 등록하기 **직전**, 반말(예의없음)·비속어를 순수 규칙으로 감지해
 *       부드럽게 되묻는(nudge) 데 쓴다. **차단이 아니라 확인**이다.
 *
 * ⛔ 이 필터는 판정만 한다. confirm/로깅/집행 여부는 호출부(폼)가 결정한다.
 * ⛔ 리스트·패턴은 전부 아래 상수 배열로 뺐다 — 단어 추가/삭제가 "한 줄"이 되게.
 *
 * 판정 순서(스펙 그대로):
 *   예외(D) 제거 → 부적절(C) 매칭 → 존댓마커(A) 있으면 통과
 *                                 / 없고 반말종결(A)이고 음슴체(B) 아니면 flag
 *
 * checkContent 는 **순수함수**다(부수효과 없음). Evaluator 가 실제 신고 데이터로
 * 정밀도를 재기 좋게, 입력 문자열만 보고 결정한다.
 */

/** 넛지 집행 스위치. false = confirm 안 띄우고 관측만(observe-first). 측정 후 켠다. */
export const NUDGE_ENFORCED = true;

/** checkContent 결과. 각 필드 true = 해당 넛지가 발동할 후보. */
export interface ContentCheck {
    /** 예의없음(반말)으로 감지됨 = 경어체 아님 */
    politeness: boolean;
    /** 부적절한 표현(비속어/초성)이 감지됨 */
    profanity: boolean;
}

/* ────────────────────────────────────────────────────────────────────────
 * A. 존댓말 마커 — 하나라도 있으면 통과(politeness=false).
 *    (일부러 넉넉하게 잡는다: 잘못 '존댓'으로 봐도 결과는 '넛지 안 함'=안전한 쪽)
 * ──────────────────────────────────────────────────────────────────────── */
export const HONORIFIC_PATTERNS: RegExp[] = [
    // ~ㅂ니다/습니다 (합니다·입니다·됩니다·있습니다 …). '아니다'(반말)는 제외.
    //   iOS Safari <16.4 lookbehind 미지원 → 앞 경계를 캡처그룹으로. .test() 소비라 소비코드 무변경.
    /(^|[^아])니다/,
    // ~세요/십시오/시죠/셔요/시오
    /세요/,
    /셔요/,
    /십시오/,
    /시죠/,
    // 죠→져 귀여운/구어 변형 (안오시져 = 안 오시죠). 존댓 계열이라 통과.
    //   ⛔ '꺼져'(반말·get lost)는 '거져'와 글자가 달라 무관하다.
    /(시져|이져|하져|거져|겠져)/,
    /시오(?![가-힣])/,
    // 존댓 상투어
    /감사합니|고맙습니|죄송합니|미안합니|부탁드립|주십시오|주세요|해주세요/,
    // ~요 로 끝나는 절 (해요·이에요·아요/어요·네요·지요·까요·데요·군요·는데요 …)
    //   줄 끝(멀티라인)에서 '요' 뒤에 문장부호/따옴표만 오는 경우.
    /요[)\]"'’”\s.!?~…,·]*$/m,
    // ── 튜닝: 혼합문 대응 — 존댓 어미는 **글 어디에 있어도** 통과시킨다.
    //   (예: "모르겠군요…나왔어야지" / "하는거죠…깠으니" 처럼 존댓 뒤에 반말이 이어지는 문장)
    //   ⛔ 맨 '요' 는 명사(중요·필요…) 오탐이라 넣지 않는다. 동사 존댓 어미 조합만.
    /(군요|네요|가요|까요|지요|데요|나요|은데요|는데요|을까요|ㄹ까요|거죠|겠죠|는거죠|하죠|이죠|죠)/,
    // ── 튜닝: 요→여 오타를 존댓으로 흡수 (네여·어여·아여·가여·구여·나여·든여·지여).
    //   문장 끝에서만. (여 자체는 반말 어미라 조합+끝단으로 한정)
    /(네|어|아|가|구|나|든|지)여[)\]"'’”\s.!?~…,·]*$/m,
    // ── 튜닝: 니다→미다 오타를 존댓으로 흡수 (입미다·합미다류). 문장 끝에서만.
    /[가-힣]미다[)\]"'’”\s.!?~…,·]*$/m
];

/* ────────────────────────────────────────────────────────────────────────
 * A. 반말 종결 — 존댓 없이 이걸로 끝나면 flag. (긴 어미가 먼저 오도록 정렬)
 * ──────────────────────────────────────────────────────────────────────── */
export const BANMAL_ENDINGS: string[] = [
    // 3자 이상
    '구나',
    '더라',
    '잖아',
    // 2자
    '는데',
    '해라',
    '이다',
    '있다',
    '없다',
    '된다',
    '같다',
    '좋다',
    '한다',
    // 1자 서술/의문/명령/청유
    '다',
    '냐',
    '니',
    '지',
    '어',
    '아',
    '야',
    '여',
    '네',
    '걸',
    '군',
    '해',
    '라',
    '게',
    '자',
    '봐',
    '와',
    '마'
];

/** 반말 종결 어미 정규식 (끝단 앵커). 상수 배열로부터 조립. */
const BANMAL_END_RE = new RegExp('(' + BANMAL_ENDINGS.join('|') + ')$');

/* ────────────────────────────────────────────────────────────────────────
 * B. 음슴체/체언 종결 = 중립(flag 안 함). '~ㅁ' 받침은 종성 코드로 판별한다.
 *    (했음·임·함·없음·좋음·슴 = 종성 ㅁ / 인 듯·한 듯 = 듯 / 것·중·예정·완료 …)
 * ──────────────────────────────────────────────────────────────────────── */
export const NEUTRAL_ENDING_WORDS: string[] = [
    '듯',
    '것',
    '중',
    '예정',
    '완료',
    '뿐',
    '따름',
    '터'
];

/** 한글 종성 인덱스: (code-0xAC00)%28. ㅁ = 16 → 음슴체. */
const JONGSEONG_MIEUM = 16;

/* ────────────────────────────────────────────────────────────────────────
 * C. 부적절한 표현.
 * ──────────────────────────────────────────────────────────────────────── */

/** 완성형 비속어. (졸라/존나 계열은 함정 처리를 위해 아래 별도 패턴으로 뺐다) */
export const PROFANITY_WORDS: string[] = [
    '병신',
    '씨발',
    '시발',
    '씨빨',
    '시빨',
    '씨바',
    '시바',
    '좆',
    '좃',
    // ⛔ 튜닝: 단독 '새끼' 삭제 — "강아지/고양이 새끼"·"새끼손가락" 오탐(실데이터 FP).
    //   사람 지칭 조합만 남긴다.
    '개새끼',
    '이새끼',
    '저새끼',
    '그새끼',
    '쌍새끼',
    '씨새끼',
    '지랄',
    '닥쳐',
    '꺼져',
    '미친놈',
    '미친년',
    '조낸',
    '존내',
    '존나' // ← 존나 는 함정이 없어 완성형에 둔다
];

/** 초성 비속어 (조합만 — "ㅈ" 단독 금지: 오탐 폭발). */
export const PROFANITY_INITIALS: string[] = [
    'ㅂㅅ',
    'ㅅㅂ',
    'ㅈ같',
    'ㅈㄴ',
    'ㅈㄹ',
    'ㅁㅊ',
    'ㄷㅊ',
    'ㄲㅈ',
    'ㅄ',
    'ㅅ끼', // 새끼 초성 변형 ("ㅅ끼")
    'ㅈ만' // 좆만 초성 변형 ("ㅈ만한") — ㅈ 단독 아님(조합)
];

/** 정규식 메타문자 이스케이프. */
function esc(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 비속어 패턴 집합.
 * - 완성형/초성: 상수 배열에서 조립.
 * - 졸라/졸래: 비속어지만 "졸라매다/졸라서(끈)"는 예외 → 부정 선읽기로 제외.
 */
const PROFANITY_PATTERNS: RegExp[] = [
    new RegExp(PROFANITY_WORDS.map(esc).join('|')),
    new RegExp(PROFANITY_INITIALS.map(esc).join('|')),
    // 졸라/졸래(=졸래) 세기 표현. 단, 졸라매·졸라서(끈 졸라매다)는 비속어 아님.
    /졸(라|래)(?!매|맸|맬|맨|맵|맴|맴|서|맸|매다)/
];

/* ────────────────────────────────────────────────────────────────────────
 * D. 예외(최우선). 감탄사/자모 노이즈, 이모지, 링크/태그/코드/숫자.
 * ──────────────────────────────────────────────────────────────────────── */

/** 웃음/노이즈 자모 (감탄·자모 단독 skip 용). 비속어 초성(ㅂㅅㅈ…)은 넣지 않는다. */
const LAUGHTER_JAMO_RE = /[ㅋㅎㄷㅠㅜㅗㅡ]/g;

/** 짧은 감탄사 단독 (와·헐·ㄷㄷ·ㅋㅋ 류). */
export const INTERJECTION_WORDS: string[] = [
    '와우',
    '우와',
    '와',
    '헐',
    '헉',
    '흠',
    '음',
    '앗',
    '악',
    '오오',
    '오',
    '어머',
    '휴',
    '아이고',
    '에이',
    '대박',
    '헐헐'
];

/** 이모지/기호 픽토그램 범위. */
const EMOJI_RE =
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{24C2}\u{1F1E6}-\u{1F1FF}]/gu;

/* ──────────────────────────────────────────────────────────────────────── */

/**
 * D. 예외 제거: 인용문(blockquote·줄앞 >)·이미지/앙티콘·코드·링크·태그·이모지 제거.
 * 남는 것은 "글쓴이 자신의 평문"이어야 한다(남의 인용은 넛지 대상이 아니다).
 */
function sanitize(raw: string): string {
    if (!raw) return '';
    let t = raw;
    // 인용(Tiptap = blockquote): 내용까지 통째로 제거
    t = t.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ' ');
    // 코드/이미지(앙티콘 포함)
    t = t.replace(/<pre[\s\S]*?<\/pre>/gi, ' ');
    t = t.replace(/<code[\s\S]*?<\/code>/gi, ' ');
    t = t.replace(/<img[^>]*>/gi, ' ');
    // 기타 태그
    t = t.replace(/<[^>]+>/g, ' ');
    // 엔티티
    t = t
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'");
    // 줄앞 인용(>) 라인은 통째로 제거 — 남의 말이라 넛지 대상 아님
    t = t
        .split('\n')
        .filter((line) => !/^\s*>+/.test(line))
        .join('\n');
    // 코드스팬/블록
    t = t.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
    // 링크
    t = t.replace(/https?:\/\/\S+/gi, ' ').replace(/www\.\S+/gi, ' ');
    // 이모지
    t = t.replace(EMOJI_RE, ' ');
    return t;
}

/** D③⑤: 남는 게 감탄사/자모/링크/#태그/코드/숫자뿐이면 skip. */
function isSkippable(clean: string): boolean {
    let s = clean
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/www\.\S+/gi, ' ')
        .replace(/#[^\s#]+/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/[0-9]+/g, ' ');
    for (const w of INTERJECTION_WORDS) s = s.split(w).join(' ');
    s = s.replace(LAUGHTER_JAMO_RE, ' ');
    // 한글 음절/자모/라틴 문자만 남긴다. (비속어 초성 ㅂㅅ 등은 자모라 남는다)
    s = s.replace(/[^가-힣ㄱ-ㅣa-zA-Z]/g, '');
    return s.length === 0;
}

/** 끝단 어미 분석용: 뒤쪽 문장부호/웃음/공백을 벗겨 마지막 의미 토막을 남긴다. */
function tailToken(clean: string): string {
    let t = clean.replace(/\s+$/u, '');
    // 반복적으로 뒤쪽 노이즈 제거
    for (let i = 0; i < 4; i++) {
        t = t.replace(/[\s.,!?~…·「」『』"'`)\]\}*_\-]+$/u, '').replace(/[ㅋㅎㄷㅠㅜㅗㅡ]+$/u, '');
    }
    return t;
}

/** A. 존댓말 마커가 하나라도 있나. */
function isHonorific(clean: string): boolean {
    return HONORIFIC_PATTERNS.some((re) => re.test(clean));
}

/** B. 음슴체/체언 종결(중립)인가. */
function isNeutralEnding(clean: string): boolean {
    const tail = tailToken(clean);
    if (!tail) return true; // 한글 없음 → 중립 취급
    if (NEUTRAL_ENDING_WORDS.some((w) => tail.endsWith(w))) return true;
    const last = tail.charCodeAt(tail.length - 1);
    if (last >= 0xac00 && last <= 0xd7a3) {
        const jong = (last - 0xac00) % 28;
        if (jong === JONGSEONG_MIEUM) return true; // ~ㅁ 받침 = 음슴체
    }
    return false;
}

/** A. 반말 종결로 끝나나. */
function hasBanmalEnding(clean: string): boolean {
    const tail = tailToken(clean);
    if (!tail) return false;
    return BANMAL_END_RE.test(tail);
}

/** C. 비속어/초성이 있나. */
function hasProfanity(clean: string): boolean {
    return PROFANITY_PATTERNS.some((re) => re.test(clean));
}

/**
 * 본문(글/댓글)을 검사한다. **순수함수** — 입력만 보고 결정, 부수효과 없음.
 *
 * @param text 원문(HTML 허용 — Tiptap 출력). 내부에서 예외(D) 제거 후 판정.
 * @returns { politeness, profanity } — 각 true = 해당 넛지 발동 후보.
 */
export function checkContent(text: string): ContentCheck {
    const clean = sanitize(text);
    const trimmed = clean.replace(/\s+/g, ' ').trim();

    // C. 부적절 매칭 (예외 제거된 평문에 대해서만 = 인용 속 욕은 안 잡는다)
    const profanity = trimmed ? hasProfanity(trimmed) : false;

    // D. 노이즈뿐이면 skip (단, 비속어가 잡혔으면 skip 하지 않는다)
    if (!profanity && isSkippable(clean)) {
        return { politeness: false, profanity: false };
    }
    if (!trimmed) {
        return { politeness: false, profanity };
    }

    // A/B. 존댓 있으면 통과 / 없고 반말종결이며 음슴체 아니면 flag
    let politeness = false;
    if (!isHonorific(clean) && !isNeutralEnding(clean) && hasBanmalEnding(clean)) {
        politeness = true;
    }

    return { politeness, profanity };
}
