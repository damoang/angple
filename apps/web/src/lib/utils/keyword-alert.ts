/**
 * 키워드 알림 — 키워드 입력 검증 (순수 함수).
 *
 * 새 글 제목에 회원이 등록한 키워드가 들어가면 알림을 보낸다. 매칭은 백엔드가 하고
 * (NFC + 소문자 후 부분 일치), 여기는 등록 단계의 규칙만 맡는다. 설정 화면(즉시 피드백)과
 * `/api/my/keyword-alerts`(최종 판정)가 **같은 함수**를 써서 규칙이 갈라지지 않게 한다.
 */

/** 키워드 최소 길이(글자 수) — 한 글자는 거의 모든 제목에 걸린다 */
export const KEYWORD_ALERT_MIN_LENGTH = 2;
/** 키워드 최대 길이(글자 수) — DB 컬럼 VARCHAR(30) 과 같다 */
export const KEYWORD_ALERT_MAX_LENGTH = 30;
/** 회원당 최대 키워드 수 */
export const KEYWORD_ALERT_MAX_COUNT = 20;

export type KeywordAlertError = 'empty' | 'too_short' | 'too_long' | 'limit' | 'duplicate';

export type KeywordAlertValidation =
    | { ok: true; keyword: string }
    | { ok: false; error: KeywordAlertError; message: string };

const MESSAGES: Record<KeywordAlertError, string> = {
    empty: '키워드를 입력해 주세요.',
    too_short: `키워드는 ${KEYWORD_ALERT_MIN_LENGTH}자 이상이어야 합니다.`,
    too_long: `키워드는 ${KEYWORD_ALERT_MAX_LENGTH}자 이하로 입력해 주세요.`,
    limit: `키워드는 최대 ${KEYWORD_ALERT_MAX_COUNT}개까지 등록할 수 있습니다.`,
    duplicate: '이미 등록된 키워드입니다.'
};

/**
 * 저장할 형태로 다듬는다: NFC 정규화 → 앞뒤 공백 제거 → 연속 공백(줄바꿈·탭 포함)을 한 칸으로.
 * 문자열이 아니면 빈 문자열.
 */
export function normalizeKeywordAlert(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** 중복 비교용 키 — 대소문자를 무시한다(백엔드 매칭 규칙과 같은 NFC + 소문자). */
export function keywordAlertKey(keyword: string): string {
    return normalizeKeywordAlert(keyword).toLowerCase();
}

/** 글자 수 — 이모지 등 서로게이트 쌍을 한 글자로 센다(DB VARCHAR 와 같은 기준). */
export function keywordAlertLength(keyword: string): number {
    return [...keyword].length;
}

/**
 * 새 키워드를 검증한다.
 *
 * @param raw      사용자가 입력한 값
 * @param existing 이 회원이 이미 등록한 키워드 목록
 */
export function validateKeywordAlert(
    raw: unknown,
    existing: readonly string[]
): KeywordAlertValidation {
    const keyword = normalizeKeywordAlert(raw);
    const fail = (error: KeywordAlertError): KeywordAlertValidation => ({
        ok: false,
        error,
        message: MESSAGES[error]
    });

    if (!keyword) return fail('empty');
    const length = keywordAlertLength(keyword);
    if (length < KEYWORD_ALERT_MIN_LENGTH) return fail('too_short');
    if (length > KEYWORD_ALERT_MAX_LENGTH) return fail('too_long');

    const key = keywordAlertKey(keyword);
    if (existing.some((k) => keywordAlertKey(k) === key)) return fail('duplicate');
    if (existing.length >= KEYWORD_ALERT_MAX_COUNT) return fail('limit');

    return { ok: true, keyword };
}

/** 검증 실패 → HTTP 상태. 형식 오류는 400, 이미 있는 상태와 부딪히면 409. */
export function keywordAlertErrorStatus(error: KeywordAlertError): 400 | 409 {
    return error === 'duplicate' || error === 'limit' ? 409 : 400;
}

/** 서버가 중복·상한을 DB 에서 다시 판정했을 때 쓰는 문구 */
export function keywordAlertErrorMessage(error: KeywordAlertError): string {
    return MESSAGES[error];
}
