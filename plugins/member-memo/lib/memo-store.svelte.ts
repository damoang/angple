/**
 * 회원 메모 캐시 스토어
 * SvelteMap 기반 반응형 캐시 — 배지가 자동 업데이트됨
 */

import { SvelteMap } from 'svelte/reactivity';
import { fetchMemo, type MemoData } from './memo-api';

// key: member_id, value: MemoData | null (null = 메모 없음, undefined = 아직 로드 안 됨)
const memoCache = new SvelteMap<string, MemoData | null>();

// 로딩 중인 ID 추적 (중복 요청 방지)
const loadingIds = new Set<string>();

/**
 * 동기 조회 (캐시에서 즉시 반환)
 * undefined = 아직 로드 안 됨, null = 메모 없음
 */
export function getMemo(memberId: string): MemoData | null | undefined {
    return memoCache.get(memberId);
}

/**
 * 단건 로드
 */
export async function loadMemo(memberId: string): Promise<void> {
    if (memoCache.has(memberId) || loadingIds.has(memberId)) return;

    loadingIds.add(memberId);
    try {
        const data = await fetchMemo(memberId);
        memoCache.set(memberId, data);
    } catch {
        memoCache.set(memberId, null);
    } finally {
        loadingIds.delete(memberId);
    }
}

/**
 * 배치 로드 — 페이지 내 모든 고유 author_id를 한번에 로드 (N+1 방지)
 * 이미 캐시된 건 스킵, 각 ID별로 개별 API 호출 (백엔드에 배치 API 없음)
 */
export async function loadMemosForAuthors(memberIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(memberIds)].filter(
        (id) => id && !memoCache.has(id) && !loadingIds.has(id)
    );

    if (uniqueIds.length === 0) return;

    await Promise.allSettled(uniqueIds.map((id) => loadMemo(id)));
}

/**
 * 캐시 갱신 (저장/삭제 후 호출)
 */
export function updateCache(memberId: string, data: MemoData | null): void {
    memoCache.set(memberId, data);
}

// 모달 상태
let _modalTarget = $state<string | null>(null);

export function getModalTarget(): string | null {
    return _modalTarget;
}

export function openModal(memberId: string): void {
    _modalTarget = memberId;
}

export function closeModal(): void {
    _modalTarget = null;
}
