import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 소셜 연동 저장 계약 (2026-08-03 관측 모드).
 *
 * 배경: 로그인 경로가 (a) 남의 (provider, identifier) 행을 DELETE 하고
 * (b) 대상 계정의 identifier 를 덮어썼다. 그래서 서로 다른 사람이 한 계정을 오갔고,
 * 덮어쓰기 때문에 조회하면 늘 1:1 로 보여 사고가 드러나지 않았다.
 *
 * 이번 단계는 **차단이 아니라 관측**이다. 지키는 계약:
 *   1. 정상 재로그인은 그대로 동작한다 (여기가 깨지면 전 회원 로그인 불가)
 *   2. 식별자가 2개 이상인 계정(실측 69건)에서도 내 행을 정확히 찾아 갱신한다
 *   3. 남의 행을 DELETE 하지 않는다
 *   4. 신원이 다르면 덮어쓰지 않고 건너뛴다 (로그인 자체는 막지 않는다)
 */

const query = vi.fn();
vi.mock('$lib/server/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));

const observeBinding = vi.fn();
vi.mock('./binding-observer.js', () => ({
    observeBinding: (...a: unknown[]) => observeBinding(...a)
}));

import { upsertSocialProfile } from './social-profile';
import type { OAuthUserProfile } from './types';

const profile = (identifier: string) =>
    ({
        identifier,
        email: 'x@example.com',
        displayName: 'tester',
        photoUrl: '',
        profileUrl: ''
    }) as OAuthUserProfile;

const row = (mp_no: number, mb_id: string, identifier: string) => ({ mp_no, mb_id, identifier });

/** 호출 순서: ① findSocialProfile ② findSocialProfilesByMemberProvider ③ 쓰기 */
function mockDb(byIdentifier: unknown | null, memberRows: unknown[]) {
    query.mockReset();
    observeBinding.mockReset();
    query
        .mockResolvedValueOnce([byIdentifier ? [byIdentifier] : []])
        .mockResolvedValueOnce([memberRows])
        .mockResolvedValue([{ affectedRows: 1 }]);
}

const sqls = () => query.mock.calls.map((c) => String(c[0]));
const kinds = () => observeBinding.mock.calls.map((c) => c[0]);

describe('upsertSocialProfile — 관측 모드', () => {
    beforeEach(() => {
        query.mockReset();
        observeBinding.mockReset();
    });

    it('정상 재로그인: 같은 신원이면 UPDATE 한다', async () => {
        mockDb(null, [row(10, 'naver_a', 'ID-1')]);
        await upsertSocialProfile('naver_a', 'naver', profile('ID-1'));

        expect(sqls().filter((s) => /UPDATE/i.test(s))).toHaveLength(1);
        expect(kinds()).toEqual([]);
    });

    it('연동이 없으면 INSERT 한다 (신규 가입)', async () => {
        mockDb(null, []);
        await upsertSocialProfile('naver_new', 'naver', profile('ID-9'));

        expect(sqls().some((s) => /INSERT/i.test(s))).toBe(true);
        expect(kinds()).toEqual([]);
    });

    it('식별자 2개인 계정에서도 내 행을 찾아 갱신한다 (락아웃 방지)', async () => {
        mockDb(null, [row(10, 'naver_a', 'ID-1'), row(11, 'naver_a', 'ID-2')]);
        await upsertSocialProfile('naver_a', 'naver', profile('ID-2'));

        const update = query.mock.calls.find((c) => /UPDATE/i.test(String(c[0])));
        expect(update).toBeDefined();
        // 내 행(mp_no=11)을 갱신해야 한다 — LIMIT 1 로 걸린 다른 행이 아니라
        expect((update?.[1] as unknown[]).at(-1)).toBe(11);
        expect(kinds()).toEqual([]);
    });

    it('신원이 다르면 덮어쓰지 않고 관측만 한다', async () => {
        mockDb(null, [row(12, 'naver_v', 'OWNER-ID')]);
        await upsertSocialProfile('naver_v', 'naver', profile('INTRUDER-ID'));

        expect(sqls().some((s) => /UPDATE|INSERT/i.test(s))).toBe(false);
        expect(kinds()).toContain('identifier_mismatch_write_skipped');
    });

    it('그 신원이 다른 회원에게 있어도 DELETE 하지 않는다', async () => {
        mockDb(row(20, 'naver_other', 'ID-1'), []);
        await upsertSocialProfile('naver_me', 'naver', profile('ID-1'));

        expect(sqls().some((s) => /DELETE/i.test(s))).toBe(false);
        expect(kinds()).toContain('identifier_bound_other_member_delete_skipped');
    });
});
