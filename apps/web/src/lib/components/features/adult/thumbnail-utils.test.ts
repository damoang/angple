import { describe, it, expect } from 'vitest';
import { extractFirstImage, resolvePostThumbnail } from './thumbnail-utils';

describe('extractFirstImage', () => {
    it('img 태그에서 src 추출', () => {
        expect(extractFirstImage('<p>text</p><img src="https://example.com/a.jpg" />')).toBe(
            'https://example.com/a.jpg'
        );
    });

    it('이미지 없으면 null', () => {
        expect(extractFirstImage('<p>no images</p>')).toBeNull();
    });

    it('작은따옴표도 처리', () => {
        expect(extractFirstImage("<img src='photo.png'>")).toBe('photo.png');
    });
});

describe('resolvePostThumbnail', () => {
    it('thumbnail 필드 우선', () => {
        expect(resolvePostThumbnail({ thumbnail: '/thumb.jpg', images: ['/img.jpg'] })).toBe(
            '/thumb.jpg'
        );
    });

    it('images 배열 사용', () => {
        const result = resolvePostThumbnail({ images: ['/img.jpg'] });
        expect(result).toContain('/img.jpg');
    });

    it('content에서 추출', () => {
        const result = resolvePostThumbnail({ content: '<img src="/content.jpg">' });
        expect(result).toContain('/content.jpg');
    });

    it('아무것도 없으면 null', () => {
        expect(resolvePostThumbnail({})).toBeNull();
    });
});
