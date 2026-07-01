/**
 * 읽은 글 표시 기능 스토어
 *
 * localStorage(L1) 기반으로 읽은 글 ID를 저장하고 관리합니다.
 * 최대 1000개까지 유지하며, 오래된 것은 자동 삭제됩니다.
 *
 * 로그인 회원은 서버 read-set(L2, Redis)을 병합해 기기·브라우저 간 읽음이
 * 일관되게 표시됩니다(메일 인앱브라우저·타기기 크로스기기). L1은 즉시 반응·
 * 오프라인·비로그인 용도로 유지하고, L2는 mergeServerReadPosts()로 합칩니다.
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_read_posts';
// 서버 read-set(L2) 상한(2000)과 맞춰, 병합 시 로컬 읽음이 굶기지 않도록 함.
const MAX_ENTRIES = 2000;

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
         * 서버 read-set(L2)을 로컬(L1)에 병합
         *
         * 로그인 시 /api/read-posts 응답(`boardId:postId` 키 배열)을 받아
         * 로컬에 없는 항목만 추가합니다. 기존 로컬 항목의 timestamp는 보존해
         * "방금 읽음"이 서버 병합으로 밀려나지 않도록 합니다.
         * @param keys `boardId:postId` 형식 키 배열 (서버 최신순)
         */
        mergeServerReadPosts(keys: string[]): void {
            if (!Array.isArray(keys) || keys.length === 0) return;
            const next = { ...data.posts };
            // 병합 항목은 로컬 최소 timestamp보다 아래로 부여 → cleanup 시 로컬(실제
            // 최근 읽음)을 우선 보존하고 서버 병합분이 먼저 밀려나게 한다.
            // 서버는 최신순이므로 index 0이 가장 높고(=base) 이후 감소해 순서 보존.
            let localMin = Number.POSITIVE_INFINITY;
            for (const ts of Object.values(next)) {
                if (ts < localMin) localMin = ts;
            }
            const base = (Number.isFinite(localMin) ? localMin : Date.now()) - 1;
            let added = 0;
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (typeof key !== 'string' || !key.includes(':')) continue;
                if (key in next) continue; // 로컬에 있으면 로컬 timestamp 유지
                next[key] = base - i;
                added++;
            }
            if (added === 0) return;
            data.posts = next;
            cleanup();
            save();
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
