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
    getLuckyTierNames,
    resetLuckyTierNamesCache,
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
