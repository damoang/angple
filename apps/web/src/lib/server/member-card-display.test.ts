import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { MemberCard } from './member-card.js';
import { authorDisplayFromCards, memberCardLookupIds } from './member-card-display.js';

function card(partial: Partial<MemberCard>): MemberCard {
    return { nick: '닉', image: '', isLeft: false, ...partial };
}

describe('memberCardLookupIds', () => {
    it('빈 값·형식 밖 id 를 빼고 중복을 없앤다(기존 사진·탈퇴 조회와 같은 대상)', () => {
        expect(
            memberCardLookupIds([
                'alice',
                '',
                null,
                undefined,
                'alice',
                'bob_2',
                'a-b',
                '한글',
                'c d'
            ])
        ).toEqual(['alice', 'bob_2']);
    });

    it('비어 있으면 빈 배열', () => {
        expect(memberCardLookupIds([])).toEqual([]);
    });
});

describe('authorDisplayFromCards', () => {
    const cards = new Map<string, MemberCard>([
        ['withimg', card({ image: 'https://img.example/a.webp', imageUpdatedAt: 1700000000 })],
        ['notime', card({ image: 'https://img.example/b.webp' })],
        ['noimg', card({ image: '' })],
        ['left', card({ isLeft: true })],
        ['leftimg', card({ isLeft: true, image: 'https://img.example/c.webp', imageUpdatedAt: 5 })]
    ]);

    it('사진 있음 — URL 과 epoch 초 시각', () => {
        expect(authorDisplayFromCards(cards, 'withimg')).toEqual({
            isLeft: false,
            image: { url: 'https://img.example/a.webp', updated_at: 1700000000 }
        });
    });

    it('사진 있음·시각 없음 — updated_at 은 undefined', () => {
        const d = authorDisplayFromCards(cards, 'notime');
        expect(d.image).toEqual({ url: 'https://img.example/b.webp', updated_at: undefined });
    });

    it('사진 없음(빈 URL) — image 없음', () => {
        expect(authorDisplayFromCards(cards, 'noimg')).toEqual({ isLeft: false });
    });

    it('탈퇴 회원', () => {
        expect(authorDisplayFromCards(cards, 'left')).toEqual({ isLeft: true });
        expect(authorDisplayFromCards(cards, 'leftimg')).toEqual({
            isLeft: true,
            image: { url: 'https://img.example/c.webp', updated_at: 5 }
        });
    });

    it('카드에 없는 회원·빈 id — 사진 없음·탈퇴 아님', () => {
        expect(authorDisplayFromCards(cards, 'ghost')).toEqual({ isLeft: false });
        expect(authorDisplayFromCards(cards, '')).toEqual({ isLeft: false });
        expect(authorDisplayFromCards(cards, undefined)).toEqual({ isLeft: false });
        expect(authorDisplayFromCards(new Map(), 'withimg')).toEqual({ isLeft: false });
    });

    it('형식 밖 id 는 카드가 있어도 사진 없음·탈퇴 아님(기존 조회와 같음)', () => {
        const odd = new Map<string, MemberCard>([
            ['a-b', card({ isLeft: true, image: 'https://img.example/d.webp' })]
        ]);
        expect(authorDisplayFromCards(odd, 'a-b')).toEqual({ isLeft: false });
    });
});

describe('라우트 연결', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const listSrc = readFileSync(resolve(here, '../../routes/[boardId]/+page.server.ts'), 'utf8');
    const detailSrc = readFileSync(
        resolve(here, '../../routes/[boardId]/[postId]/+page.server.ts'),
        'utf8'
    );

    it('게시판 목록은 회원 카드로 사진·탈퇴를 채운다', () => {
        expect(listSrc).toContain('fetchMemberCards(mbIds)');
        expect(listSrc).not.toContain('fetchMemberImagesWithTimestamp(');
        expect(listSrc).not.toContain('fetchWithdrawnMemberIds(');
        // 두 경로 모두 실패해도 목록은 진행(try/catch 안)
        expect(listSrc.match(/fetchMemberCards\(mbIds\)/g)?.length).toBe(2);
    });

    it('글 보기 작성자 표시는 회원 카드, 활동 패널 공개 판단은 탈퇴 조회 그대로', () => {
        expect(detailSrc).toContain('fetchMemberCards([post.author_id])');
        const gate = detailSrc.slice(
            detailSrc.indexOf('const memberActivityPromise'),
            detailSrc.indexOf('fetchMemberActivity(post.author_id')
        );
        expect(gate).toContain('await fetchWithdrawnMemberIds([post.author_id])');
        expect(gate).toContain('if (withdrawn.has(post.author_id)) return emptyActivity;');
    });
});
