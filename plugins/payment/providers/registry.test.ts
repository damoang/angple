import { describe, it, expect } from 'vitest';
import { getProvider, listProviders } from './registry.js';

describe('payment provider registry', () => {
    it('toss/naver/paypal 모두 등록됨', () => {
        expect.hasAssertions();
        const all = listProviders();
        expect(all).toHaveLength(3);
        expect(all.map((p) => p.id).sort()).toEqual(['naver', 'paypal', 'toss']);
    });

    it('각 provider는 prepare/complete/refund/verifyWebhook 메서드를 가짐', () => {
        expect.hasAssertions();
        for (const id of ['toss', 'naver', 'paypal'] as const) {
            const p = getProvider(id);
            expect(typeof p.prepare).toBe('function');
            expect(typeof p.complete).toBe('function');
            expect(typeof p.refund).toBe('function');
            expect(typeof p.verifyWebhook).toBe('function');
        }
    });

    it('알 수 없는 provider id는 throw', () => {
        expect.hasAssertions();
        expect(() => getProvider('unknown' as never)).toThrow();
    });
});

describe('payment provider verifyWebhook', () => {
    it('toss: 잘못된 JSON은 false', () => {
        expect.hasAssertions();
        const result = getProvider('toss').verifyWebhook(
            { siteId: 0, provider: 'toss', sandbox: true, active: true, credentials: {} as never },
            { rawBody: 'not json', headers: {} }
        );
        expect(result).toBe(false);
    });

    it('paypal: event_type+id 없는 페이로드는 false', () => {
        expect.hasAssertions();
        const result = getProvider('paypal').verifyWebhook(
            {
                siteId: 0,
                provider: 'paypal',
                sandbox: true,
                active: true,
                credentials: {} as never
            },
            { rawBody: '{"foo":"bar"}', headers: {} }
        );
        expect(result).toBe(false);
    });

    it('naver: 시그니처 헤더 없으면 false', () => {
        expect.hasAssertions();
        const result = getProvider('naver').verifyWebhook(
            {
                siteId: 0,
                provider: 'naver',
                sandbox: true,
                active: true,
                credentials: {
                    clientId: 'c',
                    clientSecret: 's',
                    chainId: 'x',
                    webhookSecret: 'w'
                } as never
            },
            { rawBody: '{}', headers: {} }
        );
        expect(result).toBe(false);
    });
});
