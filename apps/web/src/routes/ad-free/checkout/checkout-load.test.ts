/**
 * /ad-free/checkout load — 로그인 회원 식별은 locals.user.id(=mb_id) 기준.
 *
 * hooks.server.ts 가 채우는 locals.user 에는 mb_id·mb_nick 같은 필드가 없다.
 * 예전 코드는 user.mb_id 로 검사해 로그인 회원도 항상 비회원으로 처리했다.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$plugins/ad-free/server/loaders', () => ({
    loadCheckout: vi.fn(async (opts: { initialPlan: string }) => ({
        productName: '광고 제거',
        initialPlan: opts.initialPlan
    }))
}));

const { load } = await import('./+page.server');

type LoadEvent = Parameters<typeof load>[0];
type LoadResult = {
    isGuest: boolean;
    prefill: { email: string; nickname: string };
    initialPlan: string;
};

function event(user: App.Locals['user'], search = ''): LoadEvent {
    return {
        locals: { user } as App.Locals,
        url: new URL(`http://localhost/ad-free/checkout${search}`)
    } as unknown as LoadEvent;
}

async function run(user: App.Locals['user'], search = ''): Promise<LoadResult> {
    return (await load(event(user, search))) as unknown as LoadResult;
}

describe('ad-free checkout load', () => {
    it('로그인 회원이면 isGuest=false 이고 닉네임을 prefill 한다', async () => {
        const result = await run({ id: 'tester', nickname: '닉', level: 2 });
        expect(result.isGuest).toBe(false);
        expect(result.prefill).toEqual({ email: '', nickname: '닉' });
    });

    it('닉네임이 비어 있으면 회원 아이디로 prefill 한다', async () => {
        const result = await run({ id: 'tester', level: 2 });
        expect(result.isGuest).toBe(false);
        expect(result.prefill.nickname).toBe('tester');
    });

    it('비로그인이면 isGuest=true 이고 prefill 은 비어 있다', async () => {
        const result = await run(null);
        expect(result.isGuest).toBe(true);
        expect(result.prefill).toEqual({ email: '', nickname: '' });
    });

    it('id 없는 user 객체는 비회원으로 본다', async () => {
        const result = await run({ level: 0 });
        expect(result.isGuest).toBe(true);
        expect(result.prefill).toEqual({ email: '', nickname: '' });
    });

    it('plan 쿼리는 monthly/half_yearly 만 받고 나머지는 monthly', async () => {
        expect((await run(null, '?plan=half_yearly')).initialPlan).toBe('half_yearly');
        expect((await run(null, '?plan=yearly')).initialPlan).toBe('monthly');
    });
});
