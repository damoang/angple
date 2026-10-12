/**
 * /api/my/keyword-alerts — 인증·본인 한정·검증(길이·개수·중복).
 *
 * DB 는 메모리 표로 흉내 낸다. UNIQUE(mb_id, keyword) 는 대소문자 무시 콜레이션이라
 * 같은 규칙으로 ER_DUP_ENTRY 를 던진다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
    id: number;
    mb_id: string;
    keyword: string;
}

let rows: Row[] = [];
let nextId = 1;
let authUser: { mb_id: string } | null = null;
let internal = true;
let forceInsertNoop = false;

const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('SELECT id, keyword')) {
        const [mbId] = params as [string];
        return [rows.filter((r) => r.mb_id === mbId).map(({ id, keyword }) => ({ id, keyword }))];
    }
    if (sql.startsWith('INSERT INTO g5_member_keyword_alert')) {
        const [mbId, keyword, , max] = params as [string, string, string, number];
        const mine = rows.filter((r) => r.mb_id === mbId);
        if (forceInsertNoop || mine.length >= max) return [{ affectedRows: 0, insertId: 0 }];
        if (mine.some((r) => r.keyword.toLowerCase() === keyword.toLowerCase())) {
            throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
        }
        const id = nextId++;
        rows.push({ id, mb_id: mbId, keyword });
        return [{ affectedRows: 1, insertId: id }];
    }
    if (sql.startsWith('DELETE FROM g5_member_keyword_alert')) {
        const [id, mbId] = params as [number, string];
        const before = rows.length;
        rows = rows.filter((r) => !(r.id === id && r.mb_id === mbId));
        return [{ affectedRows: before - rows.length }];
    }
    throw new Error(`unexpected sql: ${sql}`);
});

vi.mock('$lib/server/db', () => ({
    default: { query: (...a: unknown[]) => query(...(a as [string, unknown[]])) }
}));
vi.mock('$lib/server/auth', () => ({ getAuthUser: async () => authUser }));
vi.mock('$lib/server/internal-api.js', () => ({
    isInternalAppRequest: () => internal,
    internalOnlyErrorResponse: () =>
        new Response(JSON.stringify({ success: false }), { status: 403 })
}));

const { GET, POST, DELETE } = await import('./+server');

const BASE = 'http://localhost/api/my/keyword-alerts';

function event(method: string, opts: { body?: unknown; search?: string } = {}) {
    const href = `${BASE}${opts.search ?? ''}`;
    const request = new Request(href, {
        method,
        headers: { 'content-type': 'application/json' },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
    return { cookies: {}, request, url: new URL(href) } as unknown as Parameters<typeof GET>[0];
}

const seed = (mbId: string, keywords: string[]) => {
    for (const keyword of keywords) rows.push({ id: nextId++, mb_id: mbId, keyword });
};
const insertCalls = () =>
    query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT')).length;

beforeEach(() => {
    rows = [];
    nextId = 1;
    authUser = { mb_id: 'member_a' };
    internal = true;
    forceInsertNoop = false;
    query.mockClear();
});

describe('인증', () => {
    it('로그인하지 않으면 GET·POST·DELETE 모두 401 이고 DB 를 건드리지 않는다', async () => {
        authUser = null;
        expect((await GET(event('GET'))).status).toBe(401);
        expect((await POST(event('POST', { body: { keyword: '맥북' } }))).status).toBe(401);
        expect((await DELETE(event('DELETE', { search: '?id=1' }))).status).toBe(401);
        expect(query).not.toHaveBeenCalled();
    });

    it('외부 출처 요청은 403', async () => {
        internal = false;
        expect((await GET(event('GET'))).status).toBe(403);
        expect((await POST(event('POST', { body: { keyword: '맥북' } }))).status).toBe(403);
        expect((await DELETE(event('DELETE', { search: '?id=1' }))).status).toBe(403);
        expect(query).not.toHaveBeenCalled();
    });
});

describe('GET', () => {
    it('내 키워드만 돌려준다', async () => {
        seed('member_a', ['맥북', '아이폰']);
        seed('member_b', ['남의키워드']);
        const res = await GET(event('GET'));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.keywords.map((k: { keyword: string }) => k.keyword)).toEqual([
            '맥북',
            '아이폰'
        ]);
        expect(body.data.max).toBe(20);
    });
});

describe('POST', () => {
    it('앞뒤 공백을 지워 저장하고 목록을 돌려준다', async () => {
        const res = await POST(event('POST', { body: { keyword: '  맥북 프로  ' } }));
        const body = await res.json();
        expect(res.status).toBe(201);
        expect(body.data.keywords).toEqual([{ id: 1, keyword: '맥북 프로' }]);
        expect(rows).toEqual([{ id: 1, mb_id: 'member_a', keyword: '맥북 프로' }]);
    });

    it('1자는 400, 31자는 400 — INSERT 하지 않는다', async () => {
        const short = await POST(event('POST', { body: { keyword: 'a' } }));
        expect(short.status).toBe(400);
        expect((await short.json()).error).toBe('too_short');

        const long = await POST(event('POST', { body: { keyword: '가'.repeat(31) } }));
        expect(long.status).toBe(400);
        expect((await long.json()).error).toBe('too_long');

        expect(insertCalls()).toBe(0);
    });

    it('본문이 없거나 키워드가 문자열이 아니면 400', async () => {
        expect((await POST(event('POST'))).status).toBe(400);
        expect((await POST(event('POST', { body: { keyword: 42 } }))).status).toBe(400);
        expect(insertCalls()).toBe(0);
    });

    it('대소문자만 다른 중복은 409', async () => {
        seed('member_a', ['iPhone']);
        const res = await POST(event('POST', { body: { keyword: 'IPHONE' } }));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toBe('duplicate');
        expect(insertCalls()).toBe(0);
    });

    it('다른 회원이 같은 키워드를 가져도 내 등록은 된다', async () => {
        seed('member_b', ['맥북']);
        const res = await POST(event('POST', { body: { keyword: '맥북' } }));
        expect(res.status).toBe(201);
    });

    it('20개가 차 있으면 409 limit', async () => {
        seed(
            'member_a',
            Array.from({ length: 20 }, (_, i) => `키워드${i}`)
        );
        const res = await POST(event('POST', { body: { keyword: '하나더' } }));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toBe('limit');
        expect(rows.filter((r) => r.mb_id === 'member_a')).toHaveLength(20);
    });

    it('동시 요청으로 DB 에서 상한에 걸리면(affectedRows 0) 409 limit', async () => {
        forceInsertNoop = true;
        const res = await POST(event('POST', { body: { keyword: '맥북' } }));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toBe('limit');
    });

    it('DB UNIQUE 위반(ER_DUP_ENTRY)은 500 이 아니라 409 duplicate', async () => {
        query.mockImplementationOnce(async () => [[]]); // 목록엔 없어 보였는데
        seed('member_a', ['맥북']); // INSERT 시점엔 이미 있다(동시 요청)
        const res = await POST(event('POST', { body: { keyword: '맥북' } }));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toBe('duplicate');
    });

    it('INSERT 는 내 mb_id 로만 한다', async () => {
        authUser = { mb_id: 'member_b' };
        await POST(event('POST', { body: { keyword: '맥북', mb_id: 'member_a' } }));
        expect(rows).toEqual([{ id: 1, mb_id: 'member_b', keyword: '맥북' }]);
    });
});

describe('DELETE', () => {
    it('내 키워드를 지우고 남은 목록을 돌려준다', async () => {
        seed('member_a', ['맥북', '아이폰']);
        const res = await DELETE(event('DELETE', { search: '?id=1' }));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.keywords).toEqual([{ id: 2, keyword: '아이폰' }]);
    });

    it('남의 키워드 id 는 404 이고 지워지지 않는다', async () => {
        seed('member_b', ['남의키워드']);
        const res = await DELETE(event('DELETE', { search: '?id=1' }));
        expect(res.status).toBe(404);
        expect(rows).toHaveLength(1);
    });

    it('id 가 없거나 숫자가 아니면 400', async () => {
        expect((await DELETE(event('DELETE'))).status).toBe(400);
        expect((await DELETE(event('DELETE', { search: '?id=abc' }))).status).toBe(400);
        expect((await DELETE(event('DELETE', { search: '?id=-3' }))).status).toBe(400);
        expect(query).not.toHaveBeenCalled();
    });
});
