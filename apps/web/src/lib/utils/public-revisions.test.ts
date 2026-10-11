import { describe, expect, it } from 'vitest';
import { isPublicRevisionBoard, revisionPlainText } from './public-revisions';
import { emailToMarker } from './email-reveal';

describe('isPublicRevisionBoard', () => {
    it('is enabled only for the configured board', () => {
        expect(isPublicRevisionBoard('claim')).toBe(true);
        expect(isPublicRevisionBoard('free')).toBe(false);
        expect(isPublicRevisionBoard('')).toBe(false);
        expect(isPublicRevisionBoard(undefined)).toBe(false);
    });
});

describe('revisionPlainText', () => {
    it('turns block tags and breaks into lines and keeps an image placeholder', () => {
        expect(revisionPlainText('<p>a</p><p>b<br>c</p><img src="x.png">')).toBe(
            'a\nb\nc\n[이미지]'
        );
    });

    it('never reveals an address hidden behind an email marker', () => {
        const text = revisionPlainText(`<p>메일 ${emailToMarker('a@b.com')}</p>`);
        expect(text).toBe('메일 [이메일]');
        expect(text).not.toContain('a@b.com');
    });

    it('returns an empty string for empty content', () => {
        expect(revisionPlainText('')).toBe('');
    });
});
