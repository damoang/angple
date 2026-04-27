import { readPool } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

export type SingoRole = 'admin' | 'super_admin' | null;

interface SingoRoleRow extends RowDataPacket {
    role: 'admin' | 'super_admin';
}

const ROLE_CACHE_TTL_MS = 60_000;
const ROLE_CACHE_MAX = 5_000; // mbId 별 entry — 회원수 증가 시 누수 방지
const roleCache = new Map<string, { role: SingoRole; expiresAt: number }>();

export async function getSingoRole(mbId: string | null | undefined): Promise<SingoRole> {
    if (!mbId) return null;

    const now = Date.now();
    const cached = roleCache.get(mbId);
    if (cached && cached.expiresAt > now) {
        return cached.role;
    }

    const [rows] = await readPool.query<SingoRoleRow[]>(
        'SELECT role FROM singo_users WHERE mb_id = ? LIMIT 1',
        [mbId]
    );

    const role: SingoRole = rows[0]?.role ?? null;

    // Backstop: cap 도달 시 oldest 50% bulk evict (insertion order)
    if (roleCache.size >= ROLE_CACHE_MAX) {
        const targetSize = Math.floor(ROLE_CACHE_MAX / 2);
        let toDrop = roleCache.size - targetSize;
        for (const k of roleCache.keys()) {
            if (toDrop-- <= 0) break;
            roleCache.delete(k);
        }
    }

    roleCache.set(mbId, { role, expiresAt: now + ROLE_CACHE_TTL_MS });
    return role;
}
