import { describe, it, expect } from 'vitest';
import { serverBlobLacksKeys } from './ui-settings-sync';

describe('serverBlobLacksKeys', () => {
    const known = ['titleBold', 'listView', 'muteKeywords'];

    it('모든 키가 있으면 false (서버로 다시 보내지 않음)', () => {
        expect(
            serverBlobLacksKeys(known, { titleBold: true, listView: 'card', muteKeywords: [] })
        ).toBe(false);
    });

    it('값이 기본값과 같아도 키만 있으면 false', () => {
        expect(
            serverBlobLacksKeys(known, { titleBold: false, listView: '', muteKeywords: [] })
        ).toBe(false);
    });

    it('새로 생긴 키가 서버에 없으면 true', () => {
        expect(serverBlobLacksKeys(known, { titleBold: true, listView: 'card' })).toBe(true);
    });

    it('서버에만 있는 옛 키는 판정에 영향 없음', () => {
        const server = { titleBold: true, listView: 'card', muteKeywords: [], oldKey: 1 };
        expect(serverBlobLacksKeys(known, server)).toBe(false);
    });

    it('null·비객체 → false', () => {
        expect(serverBlobLacksKeys(known, null)).toBe(false);
        expect(serverBlobLacksKeys(known, undefined)).toBe(false);
    });
});
