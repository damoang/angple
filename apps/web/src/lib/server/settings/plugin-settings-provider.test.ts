/**
 * 플러그인 설정 Provider 계약 테스트
 *
 * 저장소가 파일이든 DB 든 **같은 계약**을 지켜야 한다. 여기서 검증하는 것은
 * 구현 세부가 아니라 인터페이스 동작이다 — 이관 시 회귀를 잡는 안전망.
 * (이 파일 이전에는 플러그인 설정 관련 테스트가 0건이었다)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// DB/Redis 를 타지 않도록 모듈을 대체한다. 계약만 검증한다.
const dbStore = new Map<string, string>();
const cacheStore = new Map<string, string>();
/** true 면 DB 가 순단된 것처럼 예외를 던진다 */
let dbFail = false;

vi.mock('$lib/server/db', () => ({
    pool: {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
            if (dbFail && !/CREATE TABLE/i.test(sql)) throw new Error('DB 순단(테스트)');
            if (/CREATE TABLE/i.test(sql)) return [[], []];
            if (/^SELECT setting_value/i.test(sql.trim())) {
                const key = (params as string[])[0];
                const v = dbStore.get(key);
                return [v === undefined ? [] : [{ setting_value: v }], []];
            }
            if (/^SELECT setting_key, setting_value/i.test(sql.trim())) {
                return [
                    [...dbStore.entries()]
                        .filter(([k]) => k.startsWith('plugin_settings_'))
                        .map(([setting_key, setting_value]) => ({ setting_key, setting_value })),
                    []
                ];
            }
            if (/^INSERT INTO/i.test(sql.trim())) {
                const [key, value] = params as string[];
                dbStore.set(key, value);
                return [{ affectedRows: 1 }, []];
            }
            return [[], []];
        })
    }
}));

vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({
        get: async (k: string) => cacheStore.get(k) ?? null,
        setex: async (k: string, _ttl: number, v: string) => {
            cacheStore.set(k, v);
        },
        del: async (k: string) => {
            cacheStore.delete(k);
        }
    })
}));

const { MySqlPluginSettingsProvider } = await import('./mysql-plugin-settings-provider');

describe('MySqlPluginSettingsProvider — 계약', () => {
    let provider: InstanceType<typeof MySqlPluginSettingsProvider>;

    beforeEach(() => {
        dbStore.clear();
        cacheStore.clear();
        dbFail = false;
        provider = new MySqlPluginSettingsProvider();
    });

    it('초기 상태의 활성 목록은 빈 배열', async () => {
        expect(await provider.getActivePlugins()).toEqual([]);
    });

    it('활성화/비활성화가 목록에 반영된다', async () => {
        await provider.activatePlugin('fireworks');
        expect(await provider.getActivePlugins()).toEqual(['fireworks']);

        await provider.activatePlugin('emoticon');
        expect(await provider.getActivePlugins()).toEqual(['fireworks', 'emoticon']);

        await provider.deactivatePlugin('fireworks');
        expect(await provider.getActivePlugins()).toEqual(['emoticon']);
    });

    it('중복 활성화·없는 것 비활성화는 무해하다(멱등)', async () => {
        await provider.activatePlugin('a');
        await provider.activatePlugin('a');
        expect(await provider.getActivePlugins()).toEqual(['a']);

        await provider.deactivatePlugin('없는것');
        expect(await provider.getActivePlugins()).toEqual(['a']);
    });

    it('플러그인 설정을 저장하고 되읽는다', async () => {
        expect(await provider.getPluginSettings('x')).toEqual({});
        await provider.setPluginSettings('x', { enabled: true, count: 3 });
        expect(await provider.getPluginSettings('x')).toEqual({ enabled: true, count: 3 });
    });

    it('⭐ 쓰기 시 캐시를 지우지 않고 갱신한다 (다중 파드 정합의 핵심)', async () => {
        await provider.activatePlugin('fireworks');
        const cached = cacheStore.get('angple:settings:active_plugins');
        expect(cached).toBeDefined();
        expect(JSON.parse(cached as string)).toEqual(['fireworks']);
    });

    it('⭐ 다른 파드(새 인스턴스)가 즉시 같은 값을 본다 — flapping 없음', async () => {
        await provider.activatePlugin('fireworks');
        // 캐시를 공유하는 별개 인스턴스 = 다른 파드
        const other = new MySqlPluginSettingsProvider();
        expect(await other.getActivePlugins()).toEqual(['fireworks']);
    });

    it('캐시가 비어도 DB 에서 복구한다', async () => {
        await provider.setPluginSettings('y', { a: 1 });
        cacheStore.clear();
        expect(await provider.getPluginSettings('y')).toEqual({ a: 1 });
    });

    it('getAllPluginSettings 가 파일 구현과 같은 모양을 돌려준다', async () => {
        await provider.activatePlugin('a');
        await provider.setPluginSettings('a', { k: 'v' });
        const all = (await provider.getAllPluginSettings()) as {
            activePlugins: string[];
            plugins: Record<string, { settings: Record<string, unknown> }>;
            version: string;
        };
        expect(all.activePlugins).toEqual(['a']);
        expect(all.plugins.a.settings).toEqual({ k: 'v' });
        expect(all.version).toBe('1.0.0');
    });

    it('깨진 JSON 이 DB 에 있어도 기본값으로 견딘다', async () => {
        dbStore.set('active_plugins', '{깨진 값');
        expect(await provider.getActivePlugins()).toEqual([]);
    });

    it('⛔ DB 읽기 실패 시 활성 목록을 날리지 않는다 (순단 중 토글 방어)', async () => {
        await provider.activatePlugin('a');
        await provider.activatePlugin('b');
        cacheStore.clear(); // 캐시 미스 강제 → DB 로 내려감
        dbFail = true;

        await expect(provider.activatePlugin('c')).rejects.toThrow();
        dbFail = false;
        // 실패했으니 기존 목록이 그대로여야 한다 (a,b 가 c 하나로 덮이면 안 됨)
        expect(await provider.getActivePlugins()).toEqual(['a', 'b']);
    });

    it('읽기 전용 경로는 DB 실패를 흡수한다 (화면이 죽지 않게)', async () => {
        cacheStore.clear();
        dbFail = true;
        expect(await provider.getActivePlugins()).toEqual([]);
        expect(await provider.getPluginSettings('x')).toEqual({});
        dbFail = false;
    });
});
