import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery },
    pool: { query: mockQuery }
}));

// 기본은 Redis 없음(캐시 없이 DB). 캐시 테스트에서만 가짜 클라이언트를 넣는다.
// 비교 대상인 withdrawn-members 의 메모리 캐시도 이 모듈을 쓴다.
let redisClient: FakeRedis | null = null;
vi.mock('$lib/server/redis', () => ({
    getRedis: () => redisClient
}));

interface FakeRedis {
    store: Map<string, string>;
    mget: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    pipeline: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
}

/** MGET·pipeline(SETEX)·DEL 만 흉내 내는 메모리 Redis. */
function createFakeRedis(): FakeRedis {
    const store = new Map<string, string>();
    const setex = vi.fn((key: string, _ttl: number, value: string) => {
        store.set(key, value);
    });
    const fake: FakeRedis = {
        store,
        setex,
        mget: vi.fn(async (...keys: string[]) => keys.map((k) => store.get(k) ?? null)),
        del: vi.fn(async (...keys: string[]) => {
            let n = 0;
            for (const k of keys) if (store.delete(k)) n++;
            return n;
        }),
        pipeline: vi.fn(() => {
            const ops: Array<() => void> = [];
            const p = {
                setex: (key: string, ttl: number, value: string) => {
                    ops.push(() => setex(key, ttl, value));
                    return p;
                },
                exec: async () => {
                    ops.forEach((op) => op());
                    return [];
                }
            };
            return p;
        })
    };
    return fake;
}

/** fire-and-forget 저장(pipeline.exec)이 끝나도록 한 틱 넘긴다. */
async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

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
        redisClient = null;
        delete process.env.CACHE_NAMESPACE;
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

    it('결과 키는 요청한 id 그대로다(캐시 키만 소문자)', async () => {
        const { fetchMemberCards } = await loadModule();

        const cards = await fetchMemberCards(['alice', 'ALICE']);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][1]).toEqual([['alice']]);
        expect(cards.get('alice')?.nick).toBe('앨리스');
        expect(cards.get('ALICE')?.nick).toBe('앨리스');
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

    describe('공유 캐시', () => {
        beforeEach(() => {
            redisClient = createFakeRedis();
        });

        it('전부 적중하면 DB 를 부르지 않는다', async () => {
            const { fetchMemberCards } = await loadModule();
            await fetchMemberCards(['alice', 'bob', 'nobody']);
            await flush();
            mockQuery.mockClear();

            const cards = await fetchMemberCards(['alice', 'bob', 'nobody']);

            expect(mockQuery).not.toHaveBeenCalled();
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
            expect(cards.has('nobody')).toBe(false);
        });

        it('일부 미스면 미스 id 만 DB 로 읽고 SETEX 한다', async () => {
            redisClient!.store.set(
                'mbcard:alice',
                JSON.stringify({ n: '캐시닉', i: '', u: null, l: 0 })
            );
            const { fetchMemberCards } = await loadModule();

            const cards = await fetchMemberCards(['alice', 'bob']);
            await flush();

            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery.mock.calls[0][1]).toEqual([['bob']]);
            expect(cards.get('alice')?.nick).toBe('캐시닉');
            expect(cards.get('bob')?.isLeft).toBe(true);

            expect(redisClient!.setex).toHaveBeenCalledTimes(1);
            const [key, ttl, value] = redisClient!.setex.mock.calls[0];
            expect(key).toBe('mbcard:bob');
            expect(ttl).toBeGreaterThanOrEqual(600);
            expect(ttl).toBeLessThan(660);
            expect(JSON.parse(value)).toEqual({ n: '밥', i: '', u: null, l: 1 });
        });

        it('DB 에 없는 회원은 표식으로 저장해 다시 DB 를 치지 않는다', async () => {
            const { fetchMemberCards } = await loadModule();

            await fetchMemberCards(['nobody']);
            await flush();
            expect(redisClient!.store.get('mbcard:nobody')).toBe('-');

            mockQuery.mockClear();
            const cards = await fetchMemberCards(['nobody']);

            expect(mockQuery).not.toHaveBeenCalled();
            expect(cards.size).toBe(0);
        });

        it('MGET 오류면 전부 DB 로 읽는다', async () => {
            redisClient!.store.set(
                'mbcard:alice',
                JSON.stringify({ n: '캐시닉', i: '', u: null, l: 0 })
            );
            redisClient!.mget.mockRejectedValueOnce(new Error('redis down'));
            const { fetchMemberCards } = await loadModule();

            const cards = await fetchMemberCards(['alice', 'bob']);

            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery.mock.calls[0][1]).toEqual([['alice', 'bob']]);
            expect(cards.get('alice')?.nick).toBe('앨리스');
        });

        it('MGET 이 시간 안에 끝나지 않으면 전부 DB 로 읽는다', async () => {
            redisClient!.mget.mockImplementationOnce(() => new Promise(() => {}));
            const { fetchMemberCards } = await loadModule();

            const started = Date.now();
            const cards = await fetchMemberCards(['alice', 'bob']);

            expect(Date.now() - started).toBeLessThan(1000);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery.mock.calls[0][1]).toEqual([['alice', 'bob']]);
            expect(cards.get('alice')?.nick).toBe('앨리스');
        });

        it('캐시 키는 소문자이고 CACHE_NAMESPACE 를 접두한다', async () => {
            process.env.CACHE_NAMESPACE = 'canary';
            const { fetchMemberCards } = await loadModule();

            await fetchMemberCards(['ALICE']);
            await flush();

            expect(redisClient!.mget).toHaveBeenCalledWith('canary:mbcard:alice');
            expect(redisClient!.setex.mock.calls[0][0]).toBe('canary:mbcard:alice');
        });

        it('네임스페이스가 없으면 mbcard:{소문자 id} 다', async () => {
            const { fetchMemberCards } = await loadModule();

            await fetchMemberCards(['Alice']);

            expect(redisClient!.mget).toHaveBeenCalledWith('mbcard:alice');
        });

        it('invalidateMemberCard 는 현재·없음·canary 네임스페이스 키를 지운다', async () => {
            process.env.CACHE_NAMESPACE = 'staging';
            const { invalidateMemberCard } = await loadModule();

            await invalidateMemberCard('Alice');

            expect(redisClient!.del).toHaveBeenCalledTimes(1);
            expect(new Set(redisClient!.del.mock.calls[0])).toEqual(
                new Set(['staging:mbcard:alice', 'mbcard:alice', 'canary:mbcard:alice'])
            );
        });

        it('invalidateMemberCard 는 중복 키 없이 세 키 이하를 지운다', async () => {
            process.env.CACHE_NAMESPACE = 'canary';
            const { invalidateMemberCard } = await loadModule();

            await invalidateMemberCard('bob');

            expect(redisClient!.del.mock.calls[0]).toEqual(['canary:mbcard:bob', 'mbcard:bob']);
        });

        it('invalidateMemberCard 는 Redis 오류를 던지지 않는다', async () => {
            redisClient!.del.mockRejectedValueOnce(new Error('redis down'));
            const { invalidateMemberCard } = await loadModule();

            await expect(invalidateMemberCard('alice')).resolves.toBeUndefined();
        });
    });
});
