import { createHash, randomBytes } from 'node:crypto';
import { getRedis } from '$lib/server/redis';

const REDIRECT_KEY_PREFIX = 'affiliate_redirect:';
const REDIRECT_TTL_SECONDS = 60 * 60 * 24 * 30;
const inMemoryRedirects = new Map<string, { value: AffiliateRedirectRecord; expiresAt: number }>();

export interface AffiliateRedirectRecord {
    url: string;
    platform: string;
    board?: string;
    postId?: number;
    createdAt: string;
}

function cleanupExpiredInMemoryRedirects(now = Date.now()): void {
    for (const [key, entry] of inMemoryRedirects.entries()) {
        if (entry.expiresAt <= now) inMemoryRedirects.delete(key);
    }
}

function buildStableHash(input: AffiliateRedirectRecord): string {
    return createHash('sha256')
        .update(
            JSON.stringify({
                url: input.url,
                platform: input.platform,
                board: input.board || '',
                postId: input.postId || 0
            })
        )
        .digest('base64url')
        .slice(0, 24);
}

function buildRecord(input: {
    url: string;
    platform: string;
    board?: string;
    postId?: number;
}): AffiliateRedirectRecord {
    return {
        url: input.url,
        platform: input.platform,
        ...(input.board ? { board: input.board } : {}),
        ...(typeof input.postId === 'number' ? { postId: input.postId } : {}),
        createdAt: new Date().toISOString()
    };
}

async function storeRecord(id: string, record: AffiliateRedirectRecord): Promise<void> {
    cleanupExpiredInMemoryRedirects();
    inMemoryRedirects.set(id, {
        value: record,
        expiresAt: Date.now() + REDIRECT_TTL_SECONDS * 1000
    });

    try {
        const redis = getRedis();
        await redis.setex(
            `${REDIRECT_KEY_PREFIX}${id}`,
            REDIRECT_TTL_SECONDS,
            JSON.stringify(record)
        );
    } catch {
        // Redis 실패 시 메모리 fallback 유지
    }
}

export async function buildAffiliateRedirectUrl(input: {
    url: string;
    platform: string;
    board?: string;
    postId?: number;
}): Promise<string> {
    const record = buildRecord(input);
    let id = buildStableHash(record);

    try {
        const redis = getRedis();
        const existing = await redis.get(`${REDIRECT_KEY_PREFIX}${id}`);
        if (!existing) {
            await storeRecord(id, record);
        } else {
            const parsed = JSON.parse(existing) as AffiliateRedirectRecord;
            if (parsed.url !== record.url) {
                id = randomBytes(12).toString('base64url');
                await storeRecord(id, record);
            } else {
                await redis.expire(`${REDIRECT_KEY_PREFIX}${id}`, REDIRECT_TTL_SECONDS);
                inMemoryRedirects.set(id, {
                    value: parsed,
                    expiresAt: Date.now() + REDIRECT_TTL_SECONDS * 1000
                });
            }
        }
    } catch {
        const existing = inMemoryRedirects.get(id);
        if (!existing || existing.value.url !== record.url) {
            id = randomBytes(12).toString('base64url');
        }
        await storeRecord(id, record);
    }

    return `/go/${id}`;
}

export async function resolveAffiliateRedirect(
    id: string
): Promise<AffiliateRedirectRecord | null> {
    cleanupExpiredInMemoryRedirects();

    const memoryEntry = inMemoryRedirects.get(id);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
        return memoryEntry.value;
    }

    try {
        const redis = getRedis();
        const raw = await redis.get(`${REDIRECT_KEY_PREFIX}${id}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AffiliateRedirectRecord;
        inMemoryRedirects.set(id, {
            value: parsed,
            expiresAt: Date.now() + REDIRECT_TTL_SECONDS * 1000
        });
        return parsed;
    } catch {
        return null;
    }
}
