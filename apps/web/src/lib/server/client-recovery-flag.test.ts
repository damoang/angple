/**
 * 청크 복구 킬스위치 판정 시험.
 *
 * 🔴 왜 시험을 붙이는가: 이 장치는 2026-09-28 사고 뒤 「배포 없이 멈출 수단」으로 만들어졌는데,
 * 읽는 테이블(`site_settings`)이 0행이라 **두 달 가까이 끌 수 없는 상태**였다(2026-09-30 발견).
 * 비상 장치는 만들 때 한 번 눌러봐야 한다 — 그 「눌러보기」를 코드로 고정한다.
 *
 * ⭐ 판정 규약: **두 소스 중 하나라도 false 면 끈다.** 우선순위를 따지지 않는다.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;
let kv: Row[] | Error = [];
let site: Row[] | Error = [];

vi.mock('$lib/server/db.js', () => ({
    readPool: {
        query: (sql: string) => {
            const src = sql.includes('angple_settings') ? kv : site;
            return src instanceof Error ? Promise.reject(src) : Promise.resolve([src]);
        }
    }
}));

async function isEnabled(): Promise<boolean> {
    vi.resetModules(); // ⛔ 모듈에 60초 캐시가 있다 — 케이스마다 새로 불러야 한다
    const m = await import('./client-recovery-flag.js');
    return m.isClientRecoveryEnabled();
}

describe('isClientRecoveryEnabled', () => {
    beforeEach(() => {
        kv = [];
        site = [];
    });

    it('두 소스 다 없으면 켜짐 (fail-open)', async () => {
        await expect(isEnabled()).resolves.toBe(true);
    });

    it('angple_settings 가 false 면 끔 — 권장 경로', async () => {
        kv = [{ setting_value: 'false' }];
        await expect(isEnabled()).resolves.toBe(false);
    });

    it('angple_settings 가 공백 섞인 false 여도 끔', async () => {
        kv = [{ setting_value: ' false ' }];
        await expect(isEnabled()).resolves.toBe(false);
    });

    it('site_settings JSON 이 false 면 끔 — 하위호환', async () => {
        site = [{ settings_json: JSON.stringify({ client_recovery: { enabled: false } }) }];
        await expect(isEnabled()).resolves.toBe(false);
    });

    it('객체로 온 settings_json 도 읽는다', async () => {
        site = [{ settings_json: { client_recovery: { enabled: false } } }];
        await expect(isEnabled()).resolves.toBe(false);
    });

    it('⭐ 한쪽이 true 여도 다른 쪽이 false 면 끈다', async () => {
        kv = [{ setting_value: 'true' }];
        site = [{ settings_json: JSON.stringify({ client_recovery: { enabled: false } }) }];
        await expect(isEnabled()).resolves.toBe(false);
    });

    it('한쪽 조회가 실패해도 다른 쪽으로 끌 수 있다', async () => {
        kv = new Error('table missing');
        site = [{ settings_json: JSON.stringify({ client_recovery: { enabled: false } }) }];
        await expect(isEnabled()).resolves.toBe(false);
    });

    it('두 조회가 다 실패하면 켜짐 유지 (fail-open)', async () => {
        kv = new Error('down');
        site = new Error('down');
        await expect(isEnabled()).resolves.toBe(true);
    });

    it('⛔ 깨진 JSON 을 「끔」으로 읽지 않는다', async () => {
        site = [{ settings_json: '{broken' }];
        await expect(isEnabled()).resolves.toBe(true);
    });

    it('명시적으로 true 면 켜짐', async () => {
        kv = [{ setting_value: 'true' }];
        site = [{ settings_json: JSON.stringify({ client_recovery: { enabled: true } }) }];
        await expect(isEnabled()).resolves.toBe(true);
    });
});
