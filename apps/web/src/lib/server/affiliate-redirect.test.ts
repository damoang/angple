import { describe, expect, it } from 'vitest';
import {
    buildAffiliateRedirectUrl,
    resolveAffiliateRedirect,
    storeAffiliateRedirect
} from './affiliate-redirect';

describe('affiliate redirect', () => {
    it('builds short go url', async () => {
        const redirectUrl = await buildAffiliateRedirectUrl({
            url: 'https://www.aliexpress.com/item/100500.html',
            platform: 'aliexpress',
            board: 'economy',
            postId: 71002
        });

        expect(redirectUrl.startsWith('/go/')).toBe(true);
        expect(redirectUrl).not.toContain('aliexpress.com/item');
    });

    it('resolves stored payload', async () => {
        const id = await storeAffiliateRedirect({
            url: 'https://s.click.aliexpress.com/e/_abc123',
            platform: 'aliexpress',
            board: 'economy',
            postId: 71002
        });

        await expect(resolveAffiliateRedirect(id)).resolves.toEqual({
            url: 'https://s.click.aliexpress.com/e/_abc123',
            platform: 'aliexpress',
            board: 'economy',
            postId: 71002
        });
    });
});
