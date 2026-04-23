import { describe, it, expect } from 'vitest';
import { getAvatarUrl } from './member-icon';

describe('getAvatarUrl', () => {
    const CDN = 'https://s3.damoang.net';
    const path = 'data/member_image/ad/admin_1760156943.webp';

    it('size 미지정 — 원본 URL + ?v=timestamp', () => {
        const url = getAvatarUrl(path, 1760156943);
        expect(url).toBe(`${CDN}/${path}?v=1760156943`);
    });

    it('size 미지정 + updatedAt 없음 — 원본 URL only', () => {
        const url = getAvatarUrl(path);
        expect(url).toBe(`${CDN}/${path}`);
    });

    it('size=32 — Lambda variant path (jpg)', () => {
        const url = getAvatarUrl(path, 1760156943, 32);
        expect(url).toBe(`${CDN}/data/member_image/_resized/ad/admin_1760156943_32.jpg`);
        // variant URL 은 ?v= 쿼리 제거 (path 자체에 version 내재)
        expect(url).not.toContain('?v=');
    });

    it('size=192 — profile-size variant', () => {
        const url = getAvatarUrl(path, null, 192);
        expect(url).toBe(`${CDN}/data/member_image/_resized/ad/admin_1760156943_192.jpg`);
    });

    it('null imageUrl — null 반환', () => {
        expect(getAvatarUrl(null)).toBeNull();
        expect(getAvatarUrl(undefined, 123, 64)).toBeNull();
        expect(getAvatarUrl('', undefined, 32)).toBeNull();
    });

    it('이미 variant 경로 — 그대로 유지', () => {
        const variant = 'data/member_image/_resized/ad/admin_1760156943_96.jpg';
        const url = getAvatarUrl(variant, 999, 96);
        expect(url).toBe(`${CDN}/${variant}`);
    });

    it('패턴 불일치 경로 — size 무시, 원본 그대로', () => {
        const weird = 'data/other/some.jpg';
        const url = getAvatarUrl(weird, 100, 96);
        expect(url).toBe(`${CDN}/${weird}`);
    });
});
