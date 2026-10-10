import { afterEach, describe, expect, it, vi } from 'vitest';

const redisStore = new Map<string, string>();

vi.mock('./config', () => ({ getAdsServerUrl: () => 'http://ads.test' }));
vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({
        get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
        set: vi.fn(async (key: string, value: string) => {
            redisStore.set(key, value);
            return 'OK';
        }),
        del: vi.fn(async () => 1)
    })
}));

import { fetchPromotionPosts } from './promotion';

const payload = () => ({
    success: true,
    data: {
        posts: [
            { id: 1, subject: '견적 문의 sales@shop.co.kr', linkUrl: 'https://shop.co.kr' },
            { id: 2, subject: '평범한 홍보', linkUrl: 'https://a.example' }
        ],
        board_exception: ''
    }
});

type PromoResult = { data: { posts: { subject: string; linkUrl: string }[] } };

afterEach(() => {
    redisStore.clear();
    vi.unstubAllGlobals();
});

describe('fetchPromotionPosts', () => {
    it('masks addresses in post subjects served from the cache', async () => {
        redisStore.set('promotion:posts', JSON.stringify(payload()));
        const result = (await fetchPromotionPosts()) as PromoResult;
        expect(result.data.posts[0].subject).toBe('견적 문의 [이메일]');
        expect(result.data.posts[0].linkUrl).toBe('https://shop.co.kr');
        expect(result.data.posts[1].subject).toBe('평범한 홍보');
    });

    it('masks addresses in post subjects fetched from the ads server', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(payload()), { status: 200 }))
        );
        const result = (await fetchPromotionPosts()) as PromoResult;
        expect(result.data.posts[0].subject).toBe('견적 문의 [이메일]');
        expect(result.data.posts[1].subject).toBe('평범한 홍보');
    });
});
