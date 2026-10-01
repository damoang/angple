import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// site_settings 조회·저장은 DB 에 얹혀 있어 pool 을 모킹한다.
const { readQuery, writeQuery } = vi.hoisted(() => ({ readQuery: vi.fn(), writeQuery: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({
    default: { query: (...a: unknown[]) => writeQuery(...a) },
    readPool: { query: (...a: unknown[]) => readQuery(...a) }
}));

import {
    DEFAULT_PROMOTION_RULES,
    findApplicablePromotionRule,
    getPromotionRules,
    parseSettingsJson,
    savePromotionRules,
    type PromotionEligibility,
    type PromotionRule
} from './auto-promotion.js';

describe('findApplicablePromotionRule', () => {
    const eligibleMember: PromotionEligibility = {
        mb_level: 2,
        as_exp: 3000,
        login_days: 7,
        mb_certify: 'simple'
    };

    it('returns the matching rule for certified members', () => {
        expect(findApplicablePromotionRule(eligibleMember, DEFAULT_PROMOTION_RULES)).toEqual(
            DEFAULT_PROMOTION_RULES[0]
        );
    });

    it('blocks promotion for uncertified members', () => {
        expect(
            findApplicablePromotionRule(
                {
                    ...eligibleMember,
                    mb_certify: ''
                },
                DEFAULT_PROMOTION_RULES
            )
        ).toBeNull();
    });

    it('blocks promotion when thresholds are not met', () => {
        expect(
            findApplicablePromotionRule(
                {
                    ...eligibleMember,
                    as_exp: 2500
                },
                DEFAULT_PROMOTION_RULES
            )
        ).toBeNull();
    });
});

describe('parseSettingsJson', () => {
    it('일반 객체는 그대로 돌려준다 (mysql2 가 JSON 컬럼을 객체로 줌)', () => {
        const obj = { promotion_rules: [], lucky_config: { enabled: true } };
        expect(parseSettingsJson(obj)).toBe(obj);
    });

    it('JSON 문자열은 파싱한다', () => {
        expect(parseSettingsJson('{"a":1}')).toEqual({ a: 1 });
    });

    it('깨진 문자열은 null', () => {
        expect(parseSettingsJson('{not json')).toBeNull();
    });

    it('null 은 null', () => {
        expect(parseSettingsJson(null)).toBeNull();
    });

    it('배열은 null (객체·문자열 모두)', () => {
        expect(parseSettingsJson([1, 2])).toBeNull();
        expect(parseSettingsJson('[1,2]')).toBeNull();
    });

    it('숫자는 null (값·문자열 모두)', () => {
        expect(parseSettingsJson(42)).toBeNull();
        expect(parseSettingsJson('42')).toBeNull();
    });
});

describe('site_settings 승급 규칙 읽기·저장', () => {
    const rules: PromotionRule[] = [{ fromLevel: 2, toLevel: 3, minLoginDays: 10, minXP: 5000 }];

    beforeEach(() => {
        readQuery.mockReset();
        writeQuery.mockReset();
        writeQuery.mockResolvedValue([{ affectedRows: 1 }]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('객체 행에서 규칙을 읽고 오류 로그를 남기지 않는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        readQuery.mockResolvedValue([[{ settings_json: { promotion_rules: rules } }]]);

        await expect(getPromotionRules()).resolves.toEqual(rules);
        expect(errSpy).not.toHaveBeenCalled();
    });

    it('문자열 행에서도 규칙을 읽는다', async () => {
        readQuery.mockResolvedValue([
            [{ settings_json: JSON.stringify({ promotion_rules: rules }) }]
        ]);

        await expect(getPromotionRules()).resolves.toEqual(rules);
    });

    it('행이 없으면 기본 규칙', async () => {
        readQuery.mockResolvedValue([[]]);

        await expect(getPromotionRules()).resolves.toEqual(DEFAULT_PROMOTION_RULES);
    });

    it('다른 키가 있으면 JSON_SET 으로 promotion_rules 만 갱신한다', async () => {
        readQuery.mockResolvedValue([
            [{ settings_json: { lucky_config: { enabled: true }, promotion_rules: [] } }]
        ]);

        await savePromotionRules(rules);

        expect(writeQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = writeQuery.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain('JSON_SET(');
        expect(sql).toContain("'$.promotion_rules'");
        expect(sql).toContain('CAST(? AS JSON)');
        // 통째로 다시 쓰지 않으므로 파라미터에 다른 키가 실리지 않는다.
        expect(params).toEqual([JSON.stringify(rules)]);
        expect(String(params[0])).not.toContain('lucky_config');
    });

    it('해석 불가한 값이면 덮어쓰지 않고 throw 한다', async () => {
        readQuery.mockResolvedValue([[{ settings_json: '{broken' }]]);

        await expect(savePromotionRules(rules)).rejects.toThrow();
        expect(writeQuery).not.toHaveBeenCalled();
    });

    it('행이 없으면 기존처럼 INSERT 한다', async () => {
        readQuery.mockResolvedValue([[]]);

        await savePromotionRules(rules);

        expect(writeQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = writeQuery.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain('INSERT INTO site_settings');
        expect(params[0]).toBe(JSON.stringify({ promotion_rules: rules }));
    });
});
