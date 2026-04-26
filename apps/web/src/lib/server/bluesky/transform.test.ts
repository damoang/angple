import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// resolver 를 모킹해서 transform 만 검증.
const resolveBlueskyHandle = vi.fn();
vi.mock('./resolver.js', () => ({
    resolveBlueskyHandle: (h: string) => resolveBlueskyHandle(h)
}));

import { prefetchBlueskyDIDs } from './transform';

const DID_AA = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
const DID_BB = 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb';

describe('prefetchBlueskyDIDs', () => {
    beforeEach(() => {
        resolveBlueskyHandle.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('빈 입력 / 비문자열은 그대로 반환', async () => {
        await expect(prefetchBlueskyDIDs('')).resolves.toBe('');
        // @ts-expect-error 의도적 잘못된 타입 입력
        await expect(prefetchBlueskyDIDs(null)).resolves.toBe(null);
        expect(resolveBlueskyHandle).not.toHaveBeenCalled();
    });

    it('bsky.app URL 이 없으면 원본 그대로', async () => {
        const html = '<p>일반 텍스트와 <a href="https://example.com">링크</a></p>';
        const out = await prefetchBlueskyDIDs(html);
        expect(out).toBe(html);
        expect(resolveBlueskyHandle).not.toHaveBeenCalled();
    });

    it('handle URL → DID URL 치환', async () => {
        resolveBlueskyHandle.mockResolvedValue(DID_AA);
        const html = '<p>https://bsky.app/profile/aagaming.me/post/3kabc123def</p>';
        const out = await prefetchBlueskyDIDs(html);
        expect(out).toBe(`<p>https://bsky.app/profile/${DID_AA}/post/3kabc123def</p>`);
        expect(resolveBlueskyHandle).toHaveBeenCalledWith('aagaming.me');
        expect(resolveBlueskyHandle).toHaveBeenCalledTimes(1);
    });

    it('이미 DID 형식이면 resolver 호출 없이 그대로 통과', async () => {
        const html = `<p>https://bsky.app/profile/${DID_AA}/post/3kabc123def</p>`;
        const out = await prefetchBlueskyDIDs(html);
        expect(out).toBe(html);
        expect(resolveBlueskyHandle).not.toHaveBeenCalled();
    });

    it('동일 handle 이 여러 번 등장해도 한 번만 resolve + 모두 치환', async () => {
        resolveBlueskyHandle.mockResolvedValue(DID_AA);
        const html = [
            'https://bsky.app/profile/aagaming.me/post/post1',
            'https://bsky.app/profile/aagaming.me/post/post2',
            'https://bsky.app/profile/aagaming.me/post/post3'
        ].join('\n');

        const out = await prefetchBlueskyDIDs(html);
        expect(resolveBlueskyHandle).toHaveBeenCalledTimes(1);
        expect(out).toContain(`https://bsky.app/profile/${DID_AA}/post/post1`);
        expect(out).toContain(`https://bsky.app/profile/${DID_AA}/post/post2`);
        expect(out).toContain(`https://bsky.app/profile/${DID_AA}/post/post3`);
        expect(out).not.toContain('aagaming.me');
    });

    it('서로 다른 handle 은 각각 resolve 후 치환', async () => {
        resolveBlueskyHandle.mockImplementation(async (h: string) => {
            if (h === 'alice.bsky.social') return DID_AA;
            if (h === 'bob.bsky.social') return DID_BB;
            return null;
        });

        const html = [
            'https://bsky.app/profile/alice.bsky.social/post/p1',
            'https://bsky.app/profile/bob.bsky.social/post/p2'
        ].join('\n');

        const out = await prefetchBlueskyDIDs(html);
        expect(out).toContain(`https://bsky.app/profile/${DID_AA}/post/p1`);
        expect(out).toContain(`https://bsky.app/profile/${DID_BB}/post/p2`);
    });

    it('resolve null 반환 시 원본 handle URL 보존', async () => {
        resolveBlueskyHandle.mockResolvedValue(null);
        const html = '<p>https://bsky.app/profile/missing.bsky.social/post/p1</p>';
        const out = await prefetchBlueskyDIDs(html);
        expect(out).toBe(html);
    });

    it('handle + 이미 DID 인 URL 혼재', async () => {
        resolveBlueskyHandle.mockResolvedValue(DID_AA);
        const html = [
            `https://bsky.app/profile/${DID_BB}/post/keepme`,
            'https://bsky.app/profile/aagaming.me/post/replaceme'
        ].join('\n');

        const out = await prefetchBlueskyDIDs(html);
        expect(resolveBlueskyHandle).toHaveBeenCalledTimes(1);
        expect(resolveBlueskyHandle).toHaveBeenCalledWith('aagaming.me');
        expect(out).toContain(`https://bsky.app/profile/${DID_BB}/post/keepme`);
        expect(out).toContain(`https://bsky.app/profile/${DID_AA}/post/replaceme`);
    });

    it('일부 handle resolve 실패해도 성공한 것은 치환', async () => {
        resolveBlueskyHandle.mockImplementation(async (h: string) => {
            if (h === 'alice.bsky.social') return DID_AA;
            return null;
        });

        const html = [
            'https://bsky.app/profile/alice.bsky.social/post/p1',
            'https://bsky.app/profile/missing.bsky.social/post/p2'
        ].join('\n');

        const out = await prefetchBlueskyDIDs(html);
        expect(out).toContain(`https://bsky.app/profile/${DID_AA}/post/p1`);
        expect(out).toContain('https://bsky.app/profile/missing.bsky.social/post/p2');
    });
});
