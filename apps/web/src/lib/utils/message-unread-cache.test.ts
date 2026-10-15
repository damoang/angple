import { describe, expect, it } from 'vitest';
import {
    MESSAGE_UNREAD_CACHE_STORAGE_KEY,
    MESSAGE_UNREAD_CACHE_TTL_MS,
    clearMessageUnreadCache,
    readMessageUnreadCache,
    writeMessageUnreadCache
} from './message-unread-cache';

function memoryStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
        setItem: (k: string, v: string) => {
            map.set(k, v);
        },
        removeItem: (k: string) => {
            map.delete(k);
        },
        map
    };
}

describe('message-unread-cache', () => {
    it('returns the cached count for the same member within TTL', () => {
        const s = memoryStorage();
        writeMessageUnreadCache('alice', 3, 1_000, s);
        expect(readMessageUnreadCache('alice', 1_000 + MESSAGE_UNREAD_CACHE_TTL_MS - 1, s)).toBe(3);
    });

    it('expires at TTL', () => {
        const s = memoryStorage();
        writeMessageUnreadCache('alice', 3, 1_000, s);
        expect(readMessageUnreadCache('alice', 1_000 + MESSAGE_UNREAD_CACHE_TTL_MS, s)).toBeNull();
    });

    it('ignores another member’s cache (account switch)', () => {
        const s = memoryStorage();
        writeMessageUnreadCache('alice', 5, 1_000, s);
        expect(readMessageUnreadCache('bob', 1_001, s)).toBeNull();
    });

    it('returns null without a member id and does not write', () => {
        const s = memoryStorage();
        writeMessageUnreadCache(null, 5, 1_000, s);
        expect(s.map.size).toBe(0);
        writeMessageUnreadCache('alice', 5, 1_000, s);
        expect(readMessageUnreadCache(undefined, 1_001, s)).toBeNull();
    });

    it('keeps zero as a valid cached value', () => {
        const s = memoryStorage();
        writeMessageUnreadCache('alice', 0, 1_000, s);
        expect(readMessageUnreadCache('alice', 1_001, s)).toBe(0);
    });

    it('rejects future timestamps and malformed entries', () => {
        const s = memoryStorage();
        writeMessageUnreadCache('alice', 2, 5_000, s);
        expect(readMessageUnreadCache('alice', 4_000, s)).toBeNull();

        s.setItem(MESSAGE_UNREAD_CACHE_STORAGE_KEY, 'not json');
        expect(readMessageUnreadCache('alice', 5_001, s)).toBeNull();

        s.setItem(
            MESSAGE_UNREAD_CACHE_STORAGE_KEY,
            JSON.stringify({ mbId: 'alice', count: '2', fetchedAt: 5_000 })
        );
        expect(readMessageUnreadCache('alice', 5_001, s)).toBeNull();
    });

    it('clear removes the entry', () => {
        const s = memoryStorage();
        writeMessageUnreadCache('alice', 2, 1_000, s);
        clearMessageUnreadCache(s);
        expect(readMessageUnreadCache('alice', 1_001, s)).toBeNull();
    });

    it('survives storage that throws', () => {
        const throwing = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('denied');
            },
            removeItem: () => {
                throw new Error('denied');
            }
        };
        expect(() => writeMessageUnreadCache('alice', 1, 1_000, throwing)).not.toThrow();
        expect(readMessageUnreadCache('alice', 1_001, throwing)).toBeNull();
        expect(() => clearMessageUnreadCache(throwing)).not.toThrow();
    });

    it('works with no storage available (SSR)', () => {
        expect(readMessageUnreadCache('alice', 1, null)).toBeNull();
        expect(() => writeMessageUnreadCache('alice', 1, 1, null)).not.toThrow();
        expect(() => clearMessageUnreadCache(null)).not.toThrow();
    });
});
