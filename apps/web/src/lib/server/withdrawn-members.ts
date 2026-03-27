/**
 * 회원 탈퇴 여부 서버사이드 배치 조회 (SSR용)
 *
 * mb_id 배열로 g5_member.mb_leave_date를 배치 조회.
 * mb_leave_date != '' 인 회원만 true로 반환.
 */
import type { RowDataPacket } from 'mysql2';
import { createCache } from '$lib/server/cache.js';
import pool from '$lib/server/db';

const MAX_IDS = 200;
const WITHDRAWN_MEMBER_CACHE_TTL_MS = 300_000;
const withdrawnMemberCache = createCache<boolean>({
    ttl: WITHDRAWN_MEMBER_CACHE_TTL_MS,
    maxSize: 20_000
});

/**
 * 탈퇴 회원 ID Set 반환
 * @param ids mb_id 배열
 * @returns 탈퇴한 mb_id Set (탈퇴자만 포함)
 */
export async function fetchWithdrawnMemberIds(ids: string[]): Promise<Set<string>> {
    const validIds = ids.filter((id) => id && /^[a-zA-Z0-9_]+$/.test(id)).slice(0, MAX_IDS);

    if (validIds.length === 0) return new Set();

    const withdrawn = new Set<string>();
    const missingIds: string[] = [];

    for (const id of validIds) {
        const cached = withdrawnMemberCache.get(id);
        if (cached === undefined) {
            missingIds.push(id);
            continue;
        }
        if (cached) {
            withdrawn.add(id);
        }
    }

    if (missingIds.length === 0) return withdrawn;

    const placeholders = missingIds.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id FROM g5_member WHERE mb_id IN (${placeholders}) AND mb_leave_date != ''`,
        missingIds
    );

    const foundIds = new Set<string>();
    for (const row of rows) {
        foundIds.add(row.mb_id);
        withdrawnMemberCache.set(row.mb_id, true);
        withdrawn.add(row.mb_id);
    }

    for (const id of missingIds) {
        if (!foundIds.has(id)) {
            withdrawnMemberCache.set(id, false);
        }
    }

    return withdrawn;
}
