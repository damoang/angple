import { describe, expect, it } from 'vitest';
import {
    KEYWORD_ALERT_MAX_COUNT,
    KEYWORD_ALERT_MAX_LENGTH,
    keywordAlertErrorStatus,
    keywordAlertKey,
    keywordAlertLength,
    normalizeKeywordAlert,
    validateKeywordAlert
} from './keyword-alert';

const many = (n: number) => Array.from({ length: n }, (_, i) => `키워드${i}`);

describe('normalizeKeywordAlert', () => {
    it('앞뒤 공백을 지우고 안쪽 연속 공백을 한 칸으로 줄인다', () => {
        expect(normalizeKeywordAlert('  아이폰   17\n프로 ')).toBe('아이폰 17 프로');
    });

    it('문자열이 아니면 빈 문자열', () => {
        expect(normalizeKeywordAlert(undefined)).toBe('');
        expect(normalizeKeywordAlert(123)).toBe('');
        expect(normalizeKeywordAlert(null)).toBe('');
    });

    it('NFC 로 정규화한다 — 자모 분리(NFD) 입력도 같은 키워드가 된다', () => {
        const nfd = '맥북'.normalize('NFD');
        expect(nfd).not.toBe('맥북');
        expect(normalizeKeywordAlert(nfd)).toBe('맥북');
    });
});

describe('keywordAlertKey', () => {
    it('대소문자를 무시한다', () => {
        expect(keywordAlertKey('iPhone')).toBe(keywordAlertKey('IPHONE'));
    });
});

describe('keywordAlertLength', () => {
    it('이모지를 한 글자로 센다', () => {
        expect(keywordAlertLength('🍎사과')).toBe(3);
    });
});

describe('validateKeywordAlert', () => {
    it('정상 키워드는 다듬은 값으로 통과한다', () => {
        expect(validateKeywordAlert('  맥북  ', [])).toEqual({ ok: true, keyword: '맥북' });
    });

    it('빈 값·공백만은 empty', () => {
        expect(validateKeywordAlert('', [])).toMatchObject({ ok: false, error: 'empty' });
        expect(validateKeywordAlert('   ', [])).toMatchObject({ ok: false, error: 'empty' });
        expect(validateKeywordAlert(undefined, [])).toMatchObject({ ok: false, error: 'empty' });
    });

    it('2자 미만은 too_short — 공백을 지운 뒤 센다', () => {
        expect(validateKeywordAlert('a', [])).toMatchObject({ ok: false, error: 'too_short' });
        expect(validateKeywordAlert(' 가 ', [])).toMatchObject({ ok: false, error: 'too_short' });
        expect(validateKeywordAlert('ab', [])).toMatchObject({ ok: true, keyword: 'ab' });
    });

    it('30자까지 허용, 31자는 too_long', () => {
        const max = '가'.repeat(KEYWORD_ALERT_MAX_LENGTH);
        expect(validateKeywordAlert(max, [])).toMatchObject({ ok: true, keyword: max });
        expect(validateKeywordAlert(`${max}나`, [])).toMatchObject({
            ok: false,
            error: 'too_long'
        });
    });

    it('대소문자만 다른 키워드는 duplicate', () => {
        expect(validateKeywordAlert('IPHONE', ['iPhone'])).toMatchObject({
            ok: false,
            error: 'duplicate'
        });
        expect(validateKeywordAlert(' iphone ', ['iPhone'])).toMatchObject({
            ok: false,
            error: 'duplicate'
        });
    });

    it('20개가 차 있으면 limit, 19개면 통과', () => {
        expect(validateKeywordAlert('새키워드', many(KEYWORD_ALERT_MAX_COUNT))).toMatchObject({
            ok: false,
            error: 'limit'
        });
        expect(validateKeywordAlert('새키워드', many(KEYWORD_ALERT_MAX_COUNT - 1))).toMatchObject({
            ok: true
        });
    });

    it('실패 결과는 사람이 읽을 문구를 가진다', () => {
        const result = validateKeywordAlert('a', []);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toContain('2자');
    });
});

describe('keywordAlertErrorStatus', () => {
    it('형식 오류는 400, 상태 충돌은 409', () => {
        expect(keywordAlertErrorStatus('empty')).toBe(400);
        expect(keywordAlertErrorStatus('too_short')).toBe(400);
        expect(keywordAlertErrorStatus('too_long')).toBe(400);
        expect(keywordAlertErrorStatus('duplicate')).toBe(409);
        expect(keywordAlertErrorStatus('limit')).toBe(409);
    });
});
