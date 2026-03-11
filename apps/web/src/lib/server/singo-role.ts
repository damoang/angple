import { readPool } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

export type SingoRole = 'admin' | 'super_admin' | null;

interface SingoRoleRow extends RowDataPacket {
    role: 'admin' | 'super_admin';
}

const ROLE_CACHE_TTL_MS = 60_000;
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
    roleCache.set(mbId, { role, expiresAt: now + ROLE_CACHE_TTL_MS });
    return role;
}
