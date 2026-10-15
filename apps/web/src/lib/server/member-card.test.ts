import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery },
    pool: { query: mockQuery }
}));

// 비교 대상인 withdrawn-members 의 메모리 캐시가 redis 모듈을 끌어오지 않게 막는다.
vi.mock('$lib/server/redis', () => ({
    getRedis: () => null
}));

interface MemberRow {
    mb_id: string;
    mb_nick: string | null;
    mb_image_url: string | null;
    mb_image_updated_at: string | null;
    mb_leave_date: string | null;
}

/** 메모리 회원 표. 대소문자 무시 콜레이션처럼 id 를 비교한다. */
let members: MemberRow[] = [];

function findMembers(ids: string[]): MemberRow[] {
    const wanted = new Set(ids.map((id) => id.toLowerCase()));
    return members.filter((m) => wanted.has(m.mb_id.toLowerCase()));
}

/** 새 회원 카드 쿼리와 기존 탈퇴 조회 쿼리를 같은 표로 흉내 낸다. */
function answerFromTable() {
    mockQuery.mockImplementation(async (sql: string, params: unknown[]) => {
        if (sql.includes('AS is_left')) {
            const [ids] = params as [string[]];
            return [
                findMembers(ids).map((m) => ({
                    mb_id: m.mb_id,
                    mb_nick: m.mb_nick,
                    mb_image_url: m.mb_image_url ?? '',
                    mb_image_updated_at: m.mb_image_updated_at,
                    // (mb_leave_date IS NOT NULL AND mb_leave_date <> '')
                    is_left: m.mb_leave_date !== null && m.mb_leave_date !== '' ? 1 : 0
                }))
            ];
        }
        if (sql.includes("mb_leave_date != ''")) {
            // NULL != '' 은 NULL(거짓) — 탈퇴 아님
            const ids = params as string[];
            return [
                findMembers(ids)
                    .filter((m) => m.mb_leave_date !== null && m.mb_leave_date !== '')
                    .map((m) => ({ mb_id: m.mb_id }))
            ];
        }
        throw new Error(`unexpected sql: ${sql}`);
    });
}

async function loadModule() {
    vi.resetModules();
    return import('./member-card.js');
}

describe('fetchMemberCards', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        members = [
            {
                mb_id: 'alice',
                mb_nick: '앨리스',
                mb_image_url: 'https://img.example/a.webp',
                mb_image_updated_at: '2026-01-02T03:04:05Z',
                mb_leave_date: ''
            },
            {
                mb_id: 'bob',
                mb_nick: '밥',
                mb_image_url: null,
                mb_image_updated_at: null,
                mb_leave_date: '20260101'
            },
            {
                mb_id: 'carol',
                mb_nick: '캐롤',
                mb_image_url: '',
                mb_image_updated_at: null,
                mb_leave_date: null
            }
        ];
        answerFromTable();
    });

    it('빈 입력이면 쿼리를 하지 않는다', async () => {
        const { fetchMemberCards } = await loadModule();

        expect((await fetchMemberCards([])).size).toBe(0);
        expect((await fetchMemberCards(['', ''])).size).toBe(0);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('중복·빈 id 를 걸러 한 번만 조회한다', async () => {
        const { fetchMemberCards } = await loadModule();

        await fetchMemberCards(['alice', '', 'bob', 'alice', 'bob']);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][1]).toEqual([['alice', 'bob']]);
    });

    it('회원 수 상한(200)까지만 조회한다', async () => {
        const { fetchMemberCards } = await loadModule();
        const ids = Array.from({ length: 250 }, (_, i) => `user${i}`);

        await fetchMemberCards(ids);

        expect((mockQuery.mock.calls[0][1] as [string[]])[0]).toHaveLength(200);
    });

    it('닉네임·사진·사진 갱신 시각·탈퇴 여부를 매핑한다', async () => {
        const { fetchMemberCards } = await loadModule();

        const cards = await fetchMemberCards(['alice', 'bob', 'carol', 'nobody']);

        expect(cards.get('alice')).toEqual({
            nick: '앨리스',
            image: 'https://img.example/a.webp',
            imageUpdatedAt: Math.floor(Date.parse('2026-01-02T03:04:05Z') / 1000),
            isLeft: false
        });
        expect(cards.get('bob')).toEqual({
            nick: '밥',
            image: '',
            imageUpdatedAt: undefined,
            isLeft: true
        });
        expect(cards.get('carol')).toEqual({
            nick: '캐롤',
            image: '',
            imageUpdatedAt: undefined,
            isLeft: false
        });
        expect(cards.has('nobody')).toBe(false);
    });

    it('결과 키는 DB 의 mb_id 그대로다(기존 조회와 같은 키 규칙)', async () => {
        const { fetchMemberCards } = await loadModule();

        const cards = await fetchMemberCards(['ALICE']);

        expect(cards.has('alice')).toBe(true);
        expect(cards.has('ALICE')).toBe(false);
    });

    it('탈퇴 판정이 기존 fetchWithdrawnMemberIds 와 같은 입력에서 같다', async () => {
        members.push(
            {
                mb_id: 'dave',
                mb_nick: '데이브',
                mb_image_url: '',
                mb_image_updated_at: null,
                mb_leave_date: '20250505'
            },
            {
                mb_id: 'erin',
                mb_nick: '에린',
                mb_image_url: '',
                mb_image_updated_at: null,
                mb_leave_date: ''
            }
        );
        const ids = ['alice', 'bob', 'carol', 'dave', 'erin', 'nobody'];

        const { fetchMemberCards } = await loadModule();
        const cards = await fetchMemberCards(ids);
        const fromCards = [...cards].filter(([, c]) => c.isLeft).map(([id]) => id);

        vi.resetModules();
        const { fetchWithdrawnMemberIds } = await import('./withdrawn-members.js');
        const fromWithdrawn = await fetchWithdrawnMemberIds(ids);

        expect(new Set(fromCards)).toEqual(fromWithdrawn);
        expect(fromWithdrawn).toEqual(new Set(['bob', 'dave']));
    });

    it('조회 실패는 호출한 쪽으로 그대로 던진다', async () => {
        mockQuery.mockRejectedValue(new Error('db down'));
        const { fetchMemberCards } = await loadModule();

        await expect(fetchMemberCards(['alice'])).rejects.toThrow('db down');
    });
});
