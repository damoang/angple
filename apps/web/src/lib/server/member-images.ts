/**
 * 회원 프로필 이미지 서버사이드 배치 조회 (SSR용)
 *
 * mb_id 배열로 g5_member.mb_image_url을 배치 조회.
 * 게시글 목록/상세에서 author_image를 enrichment할 때 사용.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

const MAX_IDS = 200;

/**
 * 회원 프로필 이미지 URL 배치 조회
 * @param ids mb_id 배열
 * @returns { [mb_id]: mb_image_url } 맵 (이미지 없는 회원은 포함 안 됨)
 */
export async function fetchMemberImages(ids: string[]): Promise<Record<string, string>> {
    const validIds = ids.filter((id) => id && /^[a-zA-Z0-9_]+$/.test(id)).slice(0, MAX_IDS);

    if (validIds.length === 0) return {};

    const placeholders = validIds.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_image_url FROM g5_member WHERE mb_id IN (${placeholders}) AND mb_image_url != ''`,
        validIds
    );

    const images: Record<string, string> = {};
    for (const row of rows) {
        if (row.mb_image_url) {
            images[row.mb_id] = row.mb_image_url;
        }
    }
    return images;
}
