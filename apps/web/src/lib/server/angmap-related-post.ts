import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db.js';
import { createCache } from '$lib/server/cache.js';

const cache = createCache<number | null>({ ttl: 60_000, maxSize: 300 });

/** 장소 이름/좌표 근사로 다른 지점을 고르지 않고 제공자와 장소 ID로만 연결한다. */
export async function findRelatedAngmapPost(
    provider: string,
    placeId: string | null
): Promise<number | null> {
    if (!['naver', 'kakao', 'google'].includes(provider) || !placeId || placeId.length > 255) {
        return null;
    }
    try {
        return await cache.getOrSet(JSON.stringify([provider, placeId]), async () => {
            const [rows] = await readPool.query<RowDataPacket[]>(
                `SELECT p.wr_id
                   FROM angmap_places p
                   INNER JOIN g5_write_angmap w
                     ON w.wr_id = p.wr_id AND w.wr_is_comment = 0
                  WHERE p.provider = ? AND p.place_id = ?
                    AND p.resolve_status = 'ok'
                    AND w.wr_option NOT LIKE '%secret%'
                  ORDER BY p.wr_id DESC LIMIT 1`,
                [provider, placeId]
            );
            const id = Number(rows[0]?.wr_id);
            return Number.isSafeInteger(id) && id > 0 ? id : null;
        });
    } catch (error) {
        console.error('[angmap related post] lookup failed:', error);
        return null;
    }
}
