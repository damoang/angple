/**
 * 차단 회원 목록 스토어 (Svelte 5 Runes)
 *
 * 로그인 사용자가 차단한 회원 ID 목록을 캐시하여
 * 게시글/댓글 필터링에 사용
 */

import { apiClient } from '$lib/api';

let blockedIds = $state<Set<string>>(new Set());
let loaded = $state(false);

/**
 * 차단 목록 로드 (로그인 시 1회 호출)
 */
async function load(): Promise<void> {
    if (loaded) return;
    try {
        const members = await apiClient.getBlockedMembers();
        blockedIds = new Set(members.map((m) => m.mb_id));
        loaded = true;
    } catch {
        // 비로그인 또는 API 실패 시 무시
    }
}

/**
 * 특정 회원이 차단되었는지 확인
 */
function isBlocked(memberId: string): boolean {
    return blockedIds.has(memberId);
}

/**
 * 차단 추가 (프로필에서 차단 시 로컬 동기화)
 */
function add(memberId: string): void {
    blockedIds = new Set([...blockedIds, memberId]);
}

/**
 * 차단 해제 (로컬 동기화)
 */
function remove(memberId: string): void {
    const next = new Set(blockedIds);
    next.delete(memberId);
    blockedIds = next;
}

/**
 * 초기화 (로그아웃 시)
 */
function reset(): void {
    blockedIds = new Set();
    loaded = false;
}

export const blockedUsersStore = {
    get ids() {
        return blockedIds;
    },
    get loaded() {
        return loaded;
    },
    isBlocked,
    load,
    add,
    remove,
    reset
};
