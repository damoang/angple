/**
 * 헤더 쪽지 아이콘의 안 읽은 수 짧은 캐시 (sessionStorage).
 *
 * 알림 종(notification-dropdown.svelte)과 같은 방식으로, 페이지를 옮겨 다닐 때마다
 * /api/v1/messages/unread-count 를 다시 부르지 않도록 짧게 기억한다.
 *
 * 캐시에는 회원 아이디(mbId)를 함께 넣고, 읽을 때 현재 회원과 다르면 버린다.
 * 같은 탭에서 계정을 바꿔도 다른 회원의 개수가 잠깐이라도 보이지 않게 하기 위함.
 */

export const MESSAGE_UNREAD_CACHE_TTL_MS = 30_000;
export const MESSAGE_UNREAD_CACHE_STORAGE_KEY = 'angple_message_unread_cache_v1';

export interface MessageUnreadCacheEntry {
    mbId: string;
    count: number;
    fetchedAt: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
    try {
        if (typeof window === 'undefined') return null;
        return window.sessionStorage;
    } catch {
        return null;
    }
}

/**
 * 현재 회원의 유효한(만료 전) 캐시 값을 돌려준다. 없거나 만료·다른 회원이면 null.
 */
export function readMessageUnreadCache(
    mbId: string | null | undefined,
    now: number = Date.now(),
    storage: StorageLike | null = defaultStorage()
): number | null {
    if (!mbId || !storage) return null;
    try {
        const raw = storage.getItem(MESSAGE_UNREAD_CACHE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<MessageUnreadCacheEntry> | null;
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.mbId !== mbId) return null;
        if (typeof parsed.count !== 'number' || !Number.isFinite(parsed.count)) return null;
        if (typeof parsed.fetchedAt !== 'number') return null;
        const age = now - parsed.fetchedAt;
        // 시계가 거꾸로 간 경우(age < 0)도 믿지 않는다.
        if (age < 0 || age >= MESSAGE_UNREAD_CACHE_TTL_MS) return null;
        return parsed.count;
    } catch {
        return null;
    }
}

/** 현재 회원의 안 읽은 수를 기록한다. 저장 실패(사생활 모드·용량)는 무시. */
export function writeMessageUnreadCache(
    mbId: string | null | undefined,
    count: number,
    now: number = Date.now(),
    storage: StorageLike | null = defaultStorage()
): void {
    if (!mbId || !storage) return;
    const entry: MessageUnreadCacheEntry = { mbId, count, fetchedAt: now };
    try {
        storage.setItem(MESSAGE_UNREAD_CACHE_STORAGE_KEY, JSON.stringify(entry));
    } catch {
        // ignore
    }
}

/** 캐시를 지운다 (쪽지 읽음·로그아웃 등). */
export function clearMessageUnreadCache(storage: StorageLike | null = defaultStorage()): void {
    if (!storage) return;
    try {
        storage.removeItem(MESSAGE_UNREAD_CACHE_STORAGE_KEY);
    } catch {
        // ignore
    }
}
