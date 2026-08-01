import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    rememberBoardList,
    takeBoardList,
    clearBoardListCarryover
} from './board-list-carryover';
import type { FreePost } from '$lib/api/types';

const post = (id: number) => ({ id, title: 't' + id }) as FreePost;

describe('board-list-carryover — 목록→상세 재사용', () => {
    beforeEach(() => {
        clearBoardListCarryover();
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });
    afterEach(() => vi.useRealTimers());

    it('같은 보드는 돌려주고, 다른 보드는 null', () => {
        rememberBoardList({ boardId: 'free', page: 2, posts: [post(1)], total: 30, totalPages: 2 });
        expect(takeBoardList('free')?.page).toBe(2);
        expect(takeBoardList('qa')).toBeNull();
    });

    it('비파괴 읽기 — 연달아 여러 글을 봐도 유지, 반환 배열은 복사본', () => {
        rememberBoardList({ boardId: 'free', page: 1, posts: [post(1)], total: 1, totalPages: 1 });
        const a = takeBoardList('free');
        a!.posts.push(post(99));
        const b = takeBoardList('free');
        expect(b!.posts).toHaveLength(1);
    });

    it('TTL 60초 초과 시 null (폴백 fetch 경로로)', () => {
        rememberBoardList({ boardId: 'free', page: 1, posts: [post(1)], total: 1, totalPages: 1 });
        vi.setSystemTime(59_000);
        expect(takeBoardList('free')).not.toBeNull();
        vi.setSystemTime(61_000);
        expect(takeBoardList('free')).toBeNull();
    });

    it('빈 목록은 기억하지 않는다', () => {
        rememberBoardList({ boardId: 'free', page: 1, posts: [], total: 0, totalPages: 1 });
        expect(takeBoardList('free')).toBeNull();
    });
});
