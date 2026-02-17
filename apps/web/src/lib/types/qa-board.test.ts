import { describe, it, expect } from 'vitest';
import { parseQAInfo, getQAStatusLabel, getQAStatusColor } from './qa-board';
import type { QAStatus } from './qa-board';
import type { FreePost } from '$lib/api/types.js';

function makePost(overrides: Partial<FreePost> = {}): FreePost {
    return {
        id: 1,
        title: '테스트 글',
        content: '본문',
        author: 'user1',
        author_id: 'uid1',
        views: 0,
        likes: 0,
        comments_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        ...overrides
    };
}

describe('parseQAInfo', () => {
    it('모든 extra 필드가 있는 게시글 파싱', () => {
        const post = makePost({
            extra_1: 'solved',
            extra_2: '500',
            extra_3: '42'
        });
        const info = parseQAInfo(post);

        expect(info.status).toBe('solved');
        expect(info.bounty).toBe(500);
        expect(info.acceptedAnswerId).toBe(42);
    });

    it('extra 필드가 없으면 기본값 적용', () => {
        const post = makePost();
        const info = parseQAInfo(post);

        expect(info.status).toBe('unanswered');
        expect(info.bounty).toBe(0);
        expect(info.acceptedAnswerId).toBeNull();
    });

    it('bounty를 정수로 파싱', () => {
        const post = makePost({ extra_2: '1000' });
        const info = parseQAInfo(post);

        expect(info.bounty).toBe(1000);
    });

    it('bounty가 빈 문자열이면 0', () => {
        const post = makePost({ extra_2: '' });
        const info = parseQAInfo(post);

        expect(info.bounty).toBe(0);
    });

    it('acceptedAnswerId가 null (extra_3 없음)', () => {
        const post = makePost({ extra_1: 'answered' });
        const info = parseQAInfo(post);

        expect(info.acceptedAnswerId).toBeNull();
    });

    it('acceptedAnswerId가 빈 문자열이면 null', () => {
        const post = makePost({ extra_3: '' });
        const info = parseQAInfo(post);

        expect(info.acceptedAnswerId).toBeNull();
    });
});

describe('getQAStatusLabel', () => {
    it('unanswered → 미해결', () => {
        expect(getQAStatusLabel('unanswered')).toBe('미해결');
    });

    it('answered → 답변됨', () => {
        expect(getQAStatusLabel('answered')).toBe('답변됨');
    });

    it('solved → 해결됨', () => {
        expect(getQAStatusLabel('solved')).toBe('해결됨');
    });

    it('closed → 마감', () => {
        expect(getQAStatusLabel('closed')).toBe('마감');
    });
});

describe('getQAStatusColor', () => {
    const statuses: QAStatus[] = ['unanswered', 'answered', 'solved', 'closed'];

    it('unanswered → yellow 계열 클래스', () => {
        const color = getQAStatusColor('unanswered');
        expect(color).toContain('bg-yellow-100');
        expect(color).toContain('text-yellow-800');
    });

    it('answered → blue 계열 클래스', () => {
        const color = getQAStatusColor('answered');
        expect(color).toContain('bg-blue-100');
        expect(color).toContain('text-blue-800');
    });

    it('solved → green 계열 클래스', () => {
        const color = getQAStatusColor('solved');
        expect(color).toContain('bg-green-100');
        expect(color).toContain('text-green-800');
    });

    it('closed → gray 계열 클래스', () => {
        const color = getQAStatusColor('closed');
        expect(color).toContain('bg-gray-100');
        expect(color).toContain('text-gray-800');
    });

    it('모든 상태가 문자열을 반환', () => {
        for (const status of statuses) {
            expect(typeof getQAStatusColor(status)).toBe('string');
        }
    });
});
