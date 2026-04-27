import { createHash } from 'node:crypto';
import { getRedis } from '$lib/server/redis';

export interface AffiliateRedirectPayload {
    url: string;
    platform: string;
    board?: string;
    postId?: number;
}

const REDIRECT_PREFIX = 'affiliate:go:';
const REDIRECT_TTL_SEC = 60 * 60 * 24 * 180;
const L1_CACHE_MAX = 1_000; // 180일 TTL — 누수 방지 cap

const l1Cache = new Map<string, { payload: AffiliateRedirectPayload; expiresAt: number }>();

function sanitizePayload(payload: AffiliateRedirectPayload): AffiliateRedirectPayload {
    return {
        url: payload.url,
        platform: payload.platform || '',
        ...(payload.board ? { board: payload.board } : {}),
        ...(payload.postId ? { postId: payload.postId } : {})
    };
}

function buildRedirectId(payload: AffiliateRedirectPayload): string {
    const stable = JSON.stringify([
        payload.url,
        payload.platform || '',
        payload.board || '',
        payload.postId || 0
    ]);
    return createHash('sha256').update(stable).digest('base64url').slice(0, 16);
}

function setL1(id: string, payload: AffiliateRedirectPayload): void {
    // Backstop: 180일 TTL 이라 lazy evict 만으로는 부족 — cap 도달 시 oldest 50% bulk evict
    if (l1Cache.size >= L1_CACHE_MAX) {
        const targetSize = Math.floor(L1_CACHE_MAX / 2);
        let toDrop = l1Cache.size - targetSize;
        for (const k of l1Cache.keys()) {
            if (toDrop-- <= 0) break;
            l1Cache.delete(k);
        }
    }
    l1Cache.set(id, {
        payload,
        expiresAt: Date.now() + REDIRECT_TTL_SEC * 1000
    });
}

function getL1(id: string): AffiliateRedirectPayload | null {
    const cached = l1Cache.get(id);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        l1Cache.delete(id);
        return null;
    }
    return cached.payload;
}

export async function storeAffiliateRedirect(payload: AffiliateRedirectPayload): Promise<string> {
    const sanitized = sanitizePayload(payload);
    const id = buildRedirectId(sanitized);

    setL1(id, sanitized);

    try {
        await getRedis().setex(
            `${REDIRECT_PREFIX}${id}`,
            REDIRECT_TTL_SEC,
            JSON.stringify(sanitized)
        );
    } catch {
        // Redis 장애 시 L1만 사용
    }

    return id;
}

export async function resolveAffiliateRedirect(
    id: string
): Promise<AffiliateRedirectPayload | null> {
    const l1 = getL1(id);
    if (l1) return l1;

    try {
        const raw = await getRedis().get(`${REDIRECT_PREFIX}${id}`);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as AffiliateRedirectPayload;
        const sanitized = sanitizePayload(parsed);
        setL1(id, sanitized);
        return sanitized;
    } catch {
        return null;
    }
}

export async function buildAffiliateRedirectUrl(
    payload: AffiliateRedirectPayload
): Promise<string> {
    const id = await storeAffiliateRedirect(payload);
    return `/go/${id}`;
}

export async function buildAffiliateRedirectRecord(
    payload: AffiliateRedirectPayload
): Promise<{ redirectUrl: string; redirectId: string }> {
    const redirectId = await storeAffiliateRedirect(payload);
    return {
        redirectUrl: `/go/${redirectId}`,
        redirectId
    };
}
