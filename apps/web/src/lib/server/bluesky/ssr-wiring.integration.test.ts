/**
 * SSR wiring 통합 테스트 (PR-B2 of #12050)
 *
 * `+page.server.ts` 와 `comments/+server.ts` 가 본문/댓글 본문 단위로
 * `prefetchBlueskyDIDs` 를 호출하는 사용 패턴을 그대로 재현하여
 *   1) 본문 + 다수 댓글에 걸친 일괄 변환이 동작하는지
 *   2) 일부 본문이 실패해도 다른 본문은 정상 치환되는지
 *   3) 호출자가 try/catch 로 graceful degradation 한다는 약속을 지키는지
 * 를 검증한다.
 *
 * resolver 는 모킹하여 외부 API 호출 없이 결정적 결과를 만든다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveBlueskyHandle = vi.fn();
vi.mock('./resolver.js', () => ({
    resolveBlueskyHandle: (h: string) => resolveBlueskyHandle(h)
}));

import { prefetchBlueskyDIDs } from './transform';

const DID_ALICE = 'did:plc:aliceplaceholderxxxxxxxx';
const DID_BOB = 'did:plc:bobplaceholderxxxxxxxxxx';

describe('SSR wiring (post + comments batch)', () => {
    beforeEach(() => {
        resolveBlueskyHandle.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('post body + 댓글 본문들에 대해 병렬 prefetch 가 모두 치환', async () => {
        resolveBlueskyHandle.mockImplementation(async (h: string) => {
            if (h === 'alice.bsky.social') return DID_ALICE;
            if (h === 'bob.bsky.social') return DID_BOB;
            return null;
        });

        const postBody = '<p>참고: https://bsky.app/profile/alice.bsky.social/post/postA</p>';
        const commentBodies = [
            '댓글1: https://bsky.app/profile/alice.bsky.social/post/cmt1',
            '댓글2: https://bsky.app/profile/bob.bsky.social/post/cmt2',
            '댓글3: 일반 텍스트만 있음',
            '댓글4: https://bsky.app/profile/missing.bsky.social/post/cmt4'
        ];

        // +page.server.ts 패턴: post.content 단독 await
        const transformedPost = await prefetchBlueskyDIDs(postBody);

        // comments/+server.ts 패턴: comments.map(c => prefetchBlueskyDIDs(c.content))
        const transformedComments = await Promise.all(
            commentBodies.map((body) => prefetchBlueskyDIDs(body).catch(() => body))
        );

        expect(transformedPost).toBe(
            `<p>참고: https://bsky.app/profile/${DID_ALICE}/post/postA</p>`
        );
        expect(transformedComments[0]).toContain(`profile/${DID_ALICE}/post/cmt1`);
        expect(transformedComments[1]).toContain(`profile/${DID_BOB}/post/cmt2`);
        // 매칭 없는 본문은 그대로 통과
        expect(transformedComments[2]).toBe(commentBodies[2]);
        // resolve 실패한 handle 은 원본 보존
        expect(transformedComments[3]).toContain('profile/missing.bsky.social/post/cmt4');
    });

    it('댓글 한 건의 resolver throw 가 다른 댓글의 치환을 차단하지 않는다', async () => {
        // 첫 호출은 throw, 이후는 정상 — 호출자(comments/+server.ts) 의 .catch 패턴 검증.
        resolveBlueskyHandle.mockImplementation(async (h: string) => {
            if (h === 'broken.bsky.social') {
                throw new Error('network down');
            }
            if (h === 'alice.bsky.social') return DID_ALICE;
            return null;
        });

        const bodies = [
            'X: https://bsky.app/profile/broken.bsky.social/post/x1',
            'Y: https://bsky.app/profile/alice.bsky.social/post/y1'
        ];

        const out = await Promise.all(bodies.map((b) => prefetchBlueskyDIDs(b).catch(() => b)));

        // throw 한 본문은 원본 유지
        expect(out[0]).toBe(bodies[0]);
        // 다른 본문은 정상 치환
        expect(out[1]).toContain(`profile/${DID_ALICE}/post/y1`);
    });

    it('동일 handle 이 post + 여러 댓글에 흩어져 있어도 호출자별로 의존하지 않고 각각 동작', async () => {
        // resolver 는 stateless 하게 동일 결과 반환. (실 운영에선 Redis 캐시가 dedupe.)
        resolveBlueskyHandle.mockResolvedValue(DID_ALICE);

        const postBody = 'P: https://bsky.app/profile/alice.bsky.social/post/p1';
        const comments = [
            'C1: https://bsky.app/profile/alice.bsky.social/post/c1',
            'C2: https://bsky.app/profile/alice.bsky.social/post/c2'
        ];

        const [tp, tc] = await Promise.all([
            prefetchBlueskyDIDs(postBody),
            Promise.all(comments.map((c) => prefetchBlueskyDIDs(c)))
        ]);

        expect(tp).toContain(`profile/${DID_ALICE}/post/p1`);
        expect(tc[0]).toContain(`profile/${DID_ALICE}/post/c1`);
        expect(tc[1]).toContain(`profile/${DID_ALICE}/post/c2`);

        // 각 본문 단위로 1 회씩 호출 (3개 본문 × unique handle 1개)
        expect(resolveBlueskyHandle).toHaveBeenCalledTimes(3);
        expect(resolveBlueskyHandle).toHaveBeenCalledWith('alice.bsky.social');
    });
});
