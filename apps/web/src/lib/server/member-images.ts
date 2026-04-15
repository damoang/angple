/**
 * 회원 프로필 이미지 서버사이드 배치 조회 (SSR용)
 *
 * mb_id 배열로 g5_member.mb_image_url을 배치 조회.
 * 게시글 목록/상세에서 author_image를 enrichment할 때 사용.
 */
import type { RowDataPacket } from 'mysql2';
import { createCache } from '$lib/server/cache.js';
import pool from '$lib/server/db';

const MAX_IDS = 200;
const MEMBER_IMAGE_CACHE_TTL_MS = 30_000; // 30초 (프로필 사진 변경 시 빠른 반영)
const memberImageCache = createCache<MemberImageInfo | null>({
    ttl: MEMBER_IMAGE_CACHE_TTL_MS,
    maxSize: 20_000
});

export interface MemberImageInfo {
    url: string;
    updated_at?: number;
}

/**
 * 회원 프로필 이미지 URL 배치 조회
 * @param ids mb_id 배열
 * @returns { [mb_id]: mb_image_url } 맵 (이미지 없는 회원은 포함 안 됨)
 */
export async function fetchMemberImages(ids: string[]): Promise<Record<string, string>> {
    const images: Record<string, string> = {};
    const imageMap = await fetchMemberImagesWithTimestamp(ids);

    for (const [memberId, image] of Object.entries(imageMap)) {
        if (image.url) {
            images[memberId] = image.url;
        }
    }

    return images;
}

/**
 * 회원 프로필 이미지 URL + updated_at 배치 조회
 * @param ids mb_id 배열
 * @returns { [mb_id]: { url, updated_at } } 맵
 */
export async function fetchMemberImagesWithTimestamp(
    ids: string[]
): Promise<Record<string, MemberImageInfo>> {
    const validIds = ids.filter((id) => id && /^[a-zA-Z0-9_]+$/.test(id)).slice(0, MAX_IDS);

    if (validIds.length === 0) return {};

    const images: Record<string, MemberImageInfo> = {};
    const missingIds: string[] = [];

    for (const id of validIds) {
        const cached = memberImageCache.get(id);
        if (cached === undefined) {
            missingIds.push(id);
            continue;
        }
        if (cached) {
            images[id] = cached;
        }
    }

    if (missingIds.length === 0) return images;

    const placeholders = missingIds.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_image_url, mb_image_updated_at FROM g5_member WHERE mb_id IN (${placeholders}) AND mb_image_url != ''`,
        missingIds
    );

    const foundIds = new Set<string>();
    for (const row of rows) {
        if (!row.mb_image_url) continue;
        foundIds.add(row.mb_id);
        const image = {
            url: row.mb_image_url,
            updated_at: row.mb_image_updated_at
                ? Math.floor(new Date(row.mb_image_updated_at).getTime() / 1000)
                : undefined
        };
        memberImageCache.set(row.mb_id, image);
        images[row.mb_id] = image;
    }

    for (const id of missingIds) {
        if (!foundIds.has(id)) {
            memberImageCache.set(id, null);
        }
    }

    return images;
}
