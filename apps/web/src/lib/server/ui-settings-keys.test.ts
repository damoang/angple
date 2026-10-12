import { describe, it, expect } from 'vitest';
import { UI_SETTINGS_ALLOWED_KEYS } from './ui-settings-keys';
import { UI_SETTINGS_DEFAULTS } from '$lib/stores/ui-settings-defaults';

describe('UI 설정 키 — 스토어 기본값 ⊆ 서버 화이트리스트', () => {
    // 기본값에 있는 키가 화이트리스트에 없으면 서버 저장 시 조용히 버려지고,
    // 병합 시 「서버 blob 에 키 없음」 판정이 매 로드마다 참이 되어 PUT 이 반복된다.
    it('DEFAULTS 의 모든 키가 ALLOWED_KEYS 에 있다', () => {
        const missing = Object.keys(UI_SETTINGS_DEFAULTS).filter(
            (k) => !UI_SETTINGS_ALLOWED_KEYS.has(k)
        );
        expect(missing).toEqual([]);
    });

    it('DEFAULTS 에 undefined 값이 없다 (JSON 저장 시 키가 빠지지 않음)', () => {
        const undefinedKeys = Object.entries(UI_SETTINGS_DEFAULTS)
            .filter(([, v]) => v === undefined)
            .map(([k]) => k);
        expect(undefinedKeys).toEqual([]);
    });
});
