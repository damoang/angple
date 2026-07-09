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
        // #12916: 이 Set 은 글/댓글 숨김에 쓰이므로 "쪽지만 차단"(message)은 제외한다.
        // scope 미지정(구버전)은 전체 차단으로 간주해 포함.
        blockedIds = new Set(members.filter((m) => m.scope !== 'message').map((m) => m.mb_id));
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
 * 차단 추가 (프로필에서 차단 시 로컬 동기화).
 * scope='message'(쪽지만 차단)는 글/댓글 숨김 대상이 아니므로 Set 에서 제외한다 (#12916).
 */
function add(memberId: string, scope: 'all' | 'message' | 'content' = 'all'): void {
    if (scope === 'message') {
        // 쪽지만 차단 → 콘텐츠 숨김 Set 에는 넣지 않되, 기존에 있었다면 제거(범위 축소 반영).
        remove(memberId);
        return;
    }
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
