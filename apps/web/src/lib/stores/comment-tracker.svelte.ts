/**
 * 새 댓글 수 추적 스토어
 *
 * 사용자가 게시글을 열면 댓글 수를 localStorage에 기록.
 * 게시판 목록에서 현재 댓글 수와 비교하여 새 댓글 수를 표시.
 * 키: angple_comment_tracker
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_comment_tracker';
const MAX_ENTRIES = 500;

/** { "boardId:postId": commentCount } */
type TrackerData = Record<string, number>;

function loadData(): TrackerData {
    if (!browser) return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return {};
}

function saveData(data: TrackerData) {
    if (!browser) return;
    try {
        // 항목 수 제한 — 오래된 것부터 제거
        const keys = Object.keys(data);
        if (keys.length > MAX_ENTRIES) {
            const toRemove = keys.slice(0, keys.length - MAX_ENTRIES);
            for (const k of toRemove) {
                delete data[k];
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // ignore
    }
}

function createCommentTracker() {
    let data = $state<TrackerData>(loadData());

    return {
        /** 게시글 열 때 호출 — 현재 댓글 수 기록 */
        markSeen(boardId: string, postId: number | string, commentCount: number) {
            const key = `${boardId}:${postId}`;
            data[key] = commentCount;
            saveData(data);
        },

        /** 새 댓글 수 계산 (목록에서 사용) */
        getNewCount(boardId: string, postId: number | string, currentCount: number): number {
            const key = `${boardId}:${postId}`;
            const seen = data[key];
            if (seen === undefined) return 0;
            return Math.max(0, currentCount - seen);
        }
    };
}

export const commentTracker = createCommentTracker();
