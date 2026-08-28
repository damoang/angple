/**
 * 소셜 바인딩 관측이 **IP 를 남기는지**.
 *
 * ⛔ 2026-08 사고에서 `identifier_mismatch_write_skipped` 80건이 전부 `client_ip=''` 이었다.
 *    그 때문에 **11명의 피해 여부를 가리지 못했다.** 신원 지문만으로는
 *    「누가 시도했는가」를 좁힐 수 없다. 그래서 회귀로 못 박는다.
 *
 * 이 테스트는 「관측이 발화하는가」가 아니라 **「발화할 때 IP 가 실려 있는가」**를 본다.
 */
import { describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const observeBinding = vi.fn();

vi.mock('$lib/server/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
vi.mock('./binding-observer.js', () => ({
    observeBinding: (...a: unknown[]) => observeBinding(...a)
}));

const { upsertSocialProfile } = await import('./social-profile');

const CLIENT_IP = '203.0.113.77';
const profile = (identifier: string) => ({
    provider: 'naver' as const,
    identifier,
    displayName: '',
    email: '',
    photoUrl: '',
    profileUrl: ''
});

/**
 * @param mine   이 회원+provider 에 저장된 identifier 목록
 * @param others 이 회원의 **다른** provider 프로필 수
 */
function wire({ mine = [] as string[], others = 0, conflicting = null as string | null } = {}) {
    query.mockReset();
    observeBinding.mockReset();
    query.mockImplementation(async (sql: string, params: unknown[]) => {
        // findSocialProfile — 다른 회원이 이 신원을 쓰고 있나
        if (sql.includes('WHERE provider = ? AND identifier = ?'))
            return [conflicting ? [{ mb_id: conflicting }] : []];
        // findSocialProfilesByMemberProvider
        if (sql.includes('ORDER BY mp_register_day') && !sql.includes('provider <> ?'))
            return [mine.map((identifier, i) => ({ mp_no: i + 1, identifier }))];
        // 다른 provider 프로필 수
        if (sql.includes('provider <> ?')) return [[{ cnt: others }]];
        return [{ affectedRows: 1 }];
    });
}

const observedWith = (kind: string) =>
    observeBinding.mock.calls.find((c) => c[0] === kind)?.[1] as
        | Record<string, unknown>
        | undefined;

describe('upsertSocialProfile — 관측에 IP 가 실린다', () => {
    it('⛔ 신원 불일치 관측에 clientIp 가 들어간다 (80건이 비어 11명을 못 가렸다)', async () => {
        wire({ mine: ['OTHER-ID'] });
        await upsertSocialProfile('naver_v', 'naver', profile('INTRUDER-ID'), CLIENT_IP);

        const d = observedWith('identifier_mismatch_write_skipped');
        expect(d).toBeDefined();
        expect(d?.clientIp).toBe(CLIENT_IP);
        expect(d?.identifier).toBe('INTRUDER-ID'); // 지문 재료 — 원문은 observer 가 해시한다
    });

    it('기존 계정에 새 provider 가 붙는 관측에도 clientIp 가 들어간다', async () => {
        wire({ mine: [], others: 1 });
        await upsertSocialProfile('naver_v', 'naver', profile('NEW-ID'), CLIENT_IP);

        const d = observedWith('new_provider_attached_to_existing_member');
        expect(d).toBeDefined();
        expect(d?.clientIp).toBe(CLIENT_IP);
    });

    it('다른 회원에게 묶인 신원 관측에도 clientIp 가 들어간다', async () => {
        wire({ mine: ['MINE'], conflicting: 'naver_other' });
        await upsertSocialProfile('naver_v', 'naver', profile('MINE'), CLIENT_IP);

        const d = observedWith('identifier_bound_other_member_delete_skipped');
        expect(d).toBeDefined();
        expect(d?.clientIp).toBe(CLIENT_IP);
        expect(d?.otherMbId).toBe('naver_other');
    });

    it('⚠️ clientIp 를 안 넘기면 undefined 다 — 호출부가 빠뜨린 것이 드러나야 한다', async () => {
        wire({ mine: ['OTHER-ID'] });
        await upsertSocialProfile('naver_v', 'naver', profile('INTRUDER-ID'));

        expect(observedWith('identifier_mismatch_write_skipped')?.clientIp).toBeUndefined();
    });

    it('⛔ 정상 신규가입은 관측하지 않는다 — 하루 1,000건이 신호를 묻는다', async () => {
        wire({ mine: [], others: 0 });
        await upsertSocialProfile('naver_new', 'naver', profile('ID-1'), CLIENT_IP);

        expect(observedWith('new_provider_attached_to_existing_member')).toBeUndefined();
    });
});
