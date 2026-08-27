/**
 * 소셜 프로필 삭제 전 아카이브.
 *
 * ⛔ 이 테이블의 행이 기록 없이 사라지면 「이 계정이 누구 것이었는지」를 영영 잃는다.
 *    identifier 는 adler32(md5(...)) 역산이 불가능하다.
 *    2026-08 사고에서 탈퇴 계정의 86%가 소유 확인 불가였던 것이 이 때문이다.
 *
 * 그래서 두 가지를 못 박는다:
 *   ① 아카이브가 실패하면 **삭제도 안 한다**(fail-closed)
 *   ② 아카이브에 **원문 identifier 를 담지 않는다**
 */
import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('$lib/server/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));

const { deleteSocialProfile } = await import('./social-profile');

const IDENTIFIER = '3447987691';
const ROW = {
    mp_no: 71839,
    mb_id: 'naver_989f08ee',
    provider: 'kakao',
    identifier: IDENTIFIER,
    photourl: 'https://example.invalid/p.jpg',
    displayname: '표시이름',
    profileurl: 'https://example.invalid/u',
    mp_register_day: '2026-08-27 13:12:49',
    mp_latest_day: '2026-08-27 13:12:49'
};

/** archiveOk=false 이면 아카이브 INSERT 가 터진다. */
function wire({ archiveOk = true, rows = [ROW] } = {}) {
    query.mockReset();
    query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('SELECT * FROM g5_member_social_profiles')) return [rows];
        if (sql.includes('INSERT INTO g5_member_social_profiles_archive')) {
            if (!archiveOk)
                throw new Error("Table 'g5_member_social_profiles_archive' doesn't exist");
            return [{ affectedRows: rows.length }];
        }
        if (sql.startsWith('DELETE FROM g5_member_social_profiles'))
            return [{ affectedRows: rows.length }];
        throw new Error(`예상 못 한 질의: ${sql}`);
    });
}

const sqlOf = (needle: string) => query.mock.calls.filter((c) => String(c[0]).includes(needle));

describe('deleteSocialProfile — 지우기 전에 아카이브', () => {
    it('아카이브한 뒤 삭제한다', async () => {
        wire();
        await expect(deleteSocialProfile(ROW.mp_no, ROW.mb_id)).resolves.toBe(true);
        expect(sqlOf('INSERT INTO g5_member_social_profiles_archive')).toHaveLength(1);
        expect(sqlOf('DELETE FROM g5_member_social_profiles')).toHaveLength(1);
    });

    it('⛔ 아카이브가 실패하면 삭제하지 않는다 (fail-closed)', async () => {
        wire({ archiveOk: false });
        await expect(deleteSocialProfile(ROW.mp_no, ROW.mb_id)).resolves.toBe(false);
        expect(sqlOf('DELETE FROM g5_member_social_profiles')).toHaveLength(0);
    });

    it('⛔ 아카이브에 원문 identifier·표시이름·사진 URL 을 담지 않는다', async () => {
        wire();
        await deleteSocialProfile(ROW.mp_no, ROW.mb_id);
        const params = sqlOf('g5_member_social_profiles_archive')[0]?.[1] as unknown[];
        expect(params).not.toContain(IDENTIFIER);
        expect(params).not.toContain(ROW.displayname);
        expect(params).not.toContain(ROW.photourl);
        expect(params).not.toContain(ROW.profileurl);
    });

    it('⭐ 지문은 sha256 전체 64자다 — 자르면 이번 사고를 되풀이한다', async () => {
        wire();
        await deleteSocialProfile(ROW.mp_no, ROW.mb_id);
        const params = sqlOf('g5_member_social_profiles_archive')[0]?.[1] as unknown[];
        const expected = createHash('sha256').update(IDENTIFIER).digest('hex');
        expect(expected).toHaveLength(64);
        expect(params).toContain(expected);
    });

    it('지울 행이 없으면 아카이브도 남기지 않는다', async () => {
        wire({ rows: [] });
        await deleteSocialProfile(ROW.mp_no, ROW.mb_id);
        expect(sqlOf('g5_member_social_profiles_archive')).toHaveLength(0);
    });
});
