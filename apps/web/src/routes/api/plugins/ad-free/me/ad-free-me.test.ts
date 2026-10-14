/**
 * GET /api/plugins/ad-free/me — 로그인 회원 식별은 locals.user.id(=mb_id) 기준.
 *
 * 예전 코드는 존재하지 않는 user.mb_id 로 검사해 로그인 회원도 401 이었다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMembership = vi.fn(async (mbId: string, siteId: string) => ({
    mb_id: mbId,
    site_id: siteId,
    status: 'inactive'
}));

vi.mock('$plugins/ad-free/server/membership-api', () => ({
    getMembership: (mbId: string, siteId: string) => getMembership(mbId, siteId)
}));

const { GET } = await import('./+server');

function event(user: App.Locals['user']) {
    return {
        locals: { user } as App.Locals,
        request: new Request('http://localhost/api/plugins/ad-free/me'),
        url: new URL('http://localhost/api/plugins/ad-free/me')
    } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
    getMembership.mockClear();
});

describe('GET /api/plugins/ad-free/me', () => {
    it('로그인 회원이면 200 과 본인 멤버십을 돌려준다', async () => {
        const res = await GET(event({ id: 'tester', nickname: '닉', level: 2 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            mb_id: 'tester',
            site_id: 'default',
            status: 'inactive'
        });
        expect(getMembership).toHaveBeenCalledWith('tester', 'default');
    });

    it('비로그인이면 401 이고 멤버십을 조회하지 않는다', async () => {
        const res = await GET(event(null));
        expect(res.status).toBe(401);
        expect(getMembership).not.toHaveBeenCalled();
    });

    it('id 없는 user 객체도 401', async () => {
        const res = await GET(event({ level: 0 }));
        expect(res.status).toBe(401);
        expect(getMembership).not.toHaveBeenCalled();
    });
});
