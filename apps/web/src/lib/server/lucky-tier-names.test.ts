import { describe, expect, it, vi, beforeEach } from 'vitest';

let site: Record<string, unknown>[] | Error = [];
let calls = 0;

vi.mock('$lib/server/db.js', () => ({
    readPool: {
        query: () => {
            calls++;
            return site instanceof Error ? Promise.reject(site) : Promise.resolve([site]);
        }
    }
}));

import {
    getLuckyTierInfo,
    getLuckyTierNames,
    resetLuckyTierNamesCache,
    tierInfoFromSettingsJson,
    tierNamesFromSettingsJson
} from './lucky-tier-names';

describe('tierNamesFromSettingsJson', () => {
    it('문자열·객체 settings_json 모두 읽는다', () => {
        const cfg = {
            lucky_config: { windows: [{ name: '가' }], fixed_windows: [{ name: '나' }] }
        };
        expect(tierNamesFromSettingsJson(JSON.stringify(cfg))).toEqual(['가', '나']);
        expect(tierNamesFromSettingsJson(cfg)).toEqual(['가', '나']);
    });

    it('없음·깨짐은 빈 배열', () => {
        expect(tierNamesFromSettingsJson(null)).toEqual([]);
        expect(tierNamesFromSettingsJson('{broken')).toEqual([]);
        expect(tierNamesFromSettingsJson(JSON.stringify({ other: 1 }))).toEqual([]);
    });
});

describe('getLuckyTierNames (캐시)', () => {
    beforeEach(() => {
        resetLuckyTierNamesCache();
        calls = 0;
        site = [];
    });

    it('캐시 안에서는 한 번만 조회한다', async () => {
        site = [
            { settings_json: JSON.stringify({ lucky_config: { fixed_windows: [{ name: '다' }] } }) }
        ];
        await expect(getLuckyTierNames()).resolves.toEqual(['다']);
        await expect(getLuckyTierNames()).resolves.toEqual(['다']);
        expect(calls).toBe(1);
    });

    it('동시 요청은 한 번만 조회한다', async () => {
        site = [{ settings_json: null }];
        await Promise.all([getLuckyTierNames(), getLuckyTierNames(), getLuckyTierNames()]);
        expect(calls).toBe(1);
    });

    it('행 없음·조회 실패는 빈 배열(기본 이름만)', async () => {
        await expect(getLuckyTierNames()).resolves.toEqual([]);
        resetLuckyTierNamesCache();
        site = new Error('db down');
        await expect(getLuckyTierNames()).resolves.toEqual([]);
    });
});

describe('tierInfoFromSettingsJson (평소 단계 이름)', () => {
    it('base_name 을 이름 목록과 함께 읽는다', () => {
        const cfg = { lucky_config: { base_name: '평소', windows: [{ name: '가' }] } };
        expect(tierInfoFromSettingsJson(JSON.stringify(cfg))).toEqual({
            names: ['가'],
            baseName: '평소'
        });
    });

    it('base_name 미설정·깨짐이면 기본 「앙팡」', () => {
        const cfg = { lucky_config: { windows: [{ name: '가' }] } };
        expect(tierInfoFromSettingsJson(cfg)).toEqual({ names: ['가'], baseName: '앙팡' });
        expect(tierInfoFromSettingsJson(null)).toEqual({ names: [], baseName: '앙팡' });
        expect(tierInfoFromSettingsJson('{broken')).toEqual({ names: [], baseName: '앙팡' });
    });
});

describe('getLuckyTierInfo (같은 캐시·쿼리 1회)', () => {
    beforeEach(() => {
        resetLuckyTierNamesCache();
        calls = 0;
        site = [];
    });

    it('이름 목록과 base_name 을 한 번의 조회로 함께 캐시한다', async () => {
        site = [
            {
                settings_json: JSON.stringify({
                    lucky_config: { base_name: '평소', fixed_windows: [{ name: '다' }] }
                })
            }
        ];
        await expect(getLuckyTierInfo()).resolves.toEqual({ names: ['다'], baseName: '평소' });
        await expect(getLuckyTierNames()).resolves.toEqual(['다']);
        await expect(getLuckyTierInfo()).resolves.toEqual({ names: ['다'], baseName: '평소' });
        expect(calls).toBe(1);
    });

    it('조회 실패면 기본 「앙팡」', async () => {
        site = new Error('db down');
        await expect(getLuckyTierInfo()).resolves.toEqual({ names: [], baseName: '앙팡' });
    });
});
