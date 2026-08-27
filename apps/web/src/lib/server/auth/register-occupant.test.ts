/**
 * `inspectSocialMbIdOccupant` 소유 확인 판정.
 *
 * ⛔ 이 판정이 무너지면 **남의 계정을 통째로 넘긴다.** 2026-08-26 에 실제로 일어났다
 *    (`naver_989f08ee` — 침입자가 원 주인의 닉네임까지 바꿈).
 *    그래서 「해시만 겹친 경우는 절대 owned 가 아니다」를 테스트로 못 박는다.
 *
 * 판정 자체는 순수 로직이지만 DB 조회 세 번에 얹혀 있어 pool 을 모킹한다.
 */
import { describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('$lib/server/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));

const { inspectSocialMbIdOccupant, generateSocialMbId } = await import('./register');

const PROVIDER = 'kakao';
const IDENTIFIER = '5049479848';

/** 오늘/내일을 YYYYMMDD 로. 제재 만료 경계를 테스트가 날짜에 안 휘둘리게 한다. */
function ymd(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return (
        `${d.getFullYear()}` +
        `${String(d.getMonth() + 1).padStart(2, '0')}` +
        `${String(d.getDate()).padStart(2, '0')}`
    );
}

interface Scenario {
    /** g5_member 행. null 이면 점유 없음 */
    member: Record<string, unknown> | null;
    /** 이 provider 로 저장된 프로필 행 수 */
    profileRows: number;
    /** 그중 들어온 identifier 와 일치하는 행 수 */
    matching: number;
    postCount?: number;
}

let scenario: Scenario = { member: null, profileRows: 0, matching: 0 };

/**
 * ⛔ 구현은 **한 번만** 등록한다. 테스트마다 mockReset 으로 지웠다 다시 걸면
 *    호출 인자가 비어 오는 상태가 됐다(빈 SQL 로 들어와 전부 실패).
 *    시나리오만 갈아끼운다.
 */
query.mockImplementation(async (sql: string) => {
    const { member, profileRows, matching, postCount = 0 } = scenario;
    if (sql.includes('FROM g5_member ')) return [member ? [member] : []];
    if (sql.includes('g5_member_social_profiles'))
        return [[{ total: profileRows, mine: matching }]];
    if (sql.includes('g5_board_new')) return [[{ cnt: postCount }]];
    throw new Error(`예상 못 한 질의: ${sql}`);
});

function arrange(next: Scenario) {
    scenario = next;
    query.mockClear();
}

const active = {
    mb_nick: '악식가',
    mb_datetime: '2025-09-01',
    mb_leave_date: '',
    mb_intercept_date: ''
};

describe('inspectSocialMbIdOccupant — 소유 확인', () => {
    it('점유가 없으면 none', async () => {
        arrange({ member: null, profileRows: 0, matching: 0 });
        const r = await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER);
        expect(r.kind).toBe('none');
        expect(r.mbId).toBe(generateSocialMbId(PROVIDER, IDENTIFIER));
    });

    it('들어온 신원이 그 계정에 등록돼 있으면 owned', async () => {
        arrange({ member: active, profileRows: 1, matching: 1, postCount: 42 });
        const r = await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER);
        expect(r.kind).toBe('owned');
        expect(r.postCount).toBe(42);
    });

    it('⛔ 해시만 겹치고 다른 신원이 등록돼 있으면 unverified — 이것이 실사고 형태다', async () => {
        arrange({ member: active, profileRows: 1, matching: 0 });
        const r = await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER);
        expect(r.kind).toBe('unverified');
        expect(r.hasProfileRows).toBe(true);
    });

    it('⛔ 프로필 행이 아예 없으면 unverified — 대조할 근거가 없으면 내주지 않는다', async () => {
        arrange({ member: active, profileRows: 0, matching: 0 });
        const r = await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER);
        expect(r.kind).toBe('unverified');
        expect(r.hasProfileRows).toBe(false);
    });

    it('탈퇴 + 프로필 없음 = unverified, withdrawn 표시는 유지된다(사람이 확인하는 갈래)', async () => {
        arrange({
            member: { ...active, mb_leave_date: '20260101' },
            profileRows: 0,
            matching: 0
        });
        const r = await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER);
        expect(r.kind).toBe('unverified');
        expect(r.withdrawn).toBe(true);
        expect(r.hasProfileRows).toBe(false);
    });

    describe('⛔ blocked 는 소유 확인보다 앞선다 — 제재 회피를 열지 않는다', () => {
        it('소유가 확인돼도 제재중이면 blocked', async () => {
            arrange({
                member: { ...active, mb_intercept_date: ymd(3) },
                profileRows: 1,
                matching: 1
            });
            expect((await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER)).kind).toBe('blocked');
        });

        it('⭐ 프로필 행이 없어도 제재중이면 blocked — 제재계정 105개가 여기 해당한다', async () => {
            arrange({
                member: { ...active, mb_intercept_date: '99991231' },
                profileRows: 0,
                matching: 0
            });
            expect((await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER)).kind).toBe('blocked');
        });

        it('만료된 제재는 막지 않는다', async () => {
            arrange({
                member: { ...active, mb_intercept_date: ymd(-1) },
                profileRows: 1,
                matching: 1
            });
            expect((await inspectSocialMbIdOccupant(PROVIDER, IDENTIFIER)).kind).toBe('owned');
        });
    });

    it('소유 확인 질의는 provider 와 mb_id 로 좁혀서 던진다', async () => {
        arrange({ member: active, profileRows: 1, matching: 1 });
        await inspectSocialMbIdOccupant('KaKaO', IDENTIFIER);
        const call = query.mock.calls.find((c) =>
            String(c[0]).includes('g5_member_social_profiles')
        );
        expect(call).toBeDefined();
        // [identifier, mbId, provider] — provider 는 소문자로 정규화된다
        expect(call?.[1]).toEqual([IDENTIFIER, generateSocialMbId('kakao', IDENTIFIER), 'kakao']);
    });
});
