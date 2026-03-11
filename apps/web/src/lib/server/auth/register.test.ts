import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import { adler32, generateSocialMbId } from './register';

describe('generateSocialMbId', () => {
    it('keeps the provider prefix and never emits a negative hash marker', () => {
        expect(generateSocialMbId('google', '108692925130582663034')).toMatch(
            /^google_[0-9a-f]{8}$/
        );
        expect(generateSocialMbId('naver', 'XUj7e3kQ0mJ4sYw2P9')).toMatch(/^naver_[0-9a-f]{8}$/);
    });

    it('normalizes signed adler32 outputs to unsigned hex', () => {
        const identifier = 'case-0';
        const md5Hash = createHash('md5').update(identifier).digest('hex');
        const signedValue = adler32(Buffer.from(md5Hash, 'utf-8'));

        expect(signedValue).toBeLessThan(0);
        expect(generateSocialMbId('google', identifier)).toBe(
            `google_${(signedValue >>> 0).toString(16).padStart(8, '0')}`
        );
    });
});
