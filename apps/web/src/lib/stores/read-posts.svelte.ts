/**
 * 읽은 글 표시 기능 스토어
 *
 * localStorage 기반으로 읽은 글 ID를 저장하고 관리합니다.
 * 최대 1000개까지 유지하며, 오래된 것은 자동 삭제됩니다.
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_read_posts';
const MAX_ENTRIES = 1000;

interface ReadPostsData {
    // postId를 key로, timestamp를 value로 저장 (FIFO 삭제용)
    posts: Record<string, number>;
}

function createReadPostsStore() {
    let data = $state<ReadPostsData>({ posts: {} });

    // 브라우저에서만 localStorage 로드
    if (browser) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                data = JSON.parse(stored);
            }
        } catch {
            // localStorage 접근 실패 시 무시
        }
    }

    function save(): void {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // localStorage 저장 실패 시 무시 (쿼터 초과 등)
        }
    }

    function cleanup(): void {
        const entries = Object.entries(data.posts);
        if (entries.length <= MAX_ENTRIES) return;

        // timestamp 기준 오름차순 정렬 후 오래된 것부터 삭제
        entries.sort((a, b) => a[1] - b[1]);
        const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);

        for (const [key] of toRemove) {
            delete data.posts[key];
        }
    }

    return {
        /**
         * 글을 읽음으로 표시
         * @param boardId 게시판 ID
         * @param postId 게시글 ID
         */
        markAsRead(boardId: string, postId: number): void {
            const key = `${boardId}:${postId}`;
            data.posts = { ...data.posts, [key]: Date.now() };
            cleanup();
            save();
        },

        /**
         * 글을 읽었는지 확인
         * @param boardId 게시판 ID
         * @param postId 게시글 ID
         */
        isRead(boardId: string, postId: number): boolean {
            const key = `${boardId}:${postId}`;
            return key in data.posts;
        },

        /**
         * 특정 게시판의 읽은 글 목록 조회
         * @param boardId 게시판 ID
         */
        getReadPostIds(boardId: string): Set<number> {
            const prefix = `${boardId}:`;
            const result = new Set<number>();

            for (const key of Object.keys(data.posts)) {
                if (key.startsWith(prefix)) {
                    const postId = parseInt(key.slice(prefix.length), 10);
                    if (!isNaN(postId)) {
                        result.add(postId);
                    }
                }
            }

            return result;
        },

        /**
         * 모든 읽은 글 기록 삭제
         */
        clear(): void {
            data = { posts: {} };
            save();
        },

        /**
         * 저장된 글 개수
         */
        get count(): number {
            return Object.keys(data.posts).length;
        }
    };
}

export const readPostsStore = createReadPostsStore();
