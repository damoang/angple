/**
 * 축하메시지 조회 공유 모듈
 *
 * +layout.server.ts (SSR), /api/init, /api/ads/celebration/today 에서 공유.
 * 서버 사이드 60초 인메모리 캐시 포함.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { createCache } from '$lib/server/cache';

export interface CelebrationBanner {
    id: number;
    title: string;
    content: string;
    image_url: string;
    link_url: string;
    display_date: string;
    is_active: boolean;
    target_member_id?: string;
    target_member_nick?: string;
    target_member_photo?: string;
    external_link?: string;
    link_target?: string;
    sort_order?: number;
    display_type: 'image' | 'text';
}

function getMemberPhotoUrl(mbImageUrl: string | null | undefined): string | undefined {
    if (!mbImageUrl) return undefined;
    return `https://s3.damoang.net/${mbImageUrl}`;
}

function extractFirstImage(content: string): string | null {
    if (!content) return null;
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
        let imgUrl = imgMatch[1];
        if (imgUrl.startsWith('/data/')) {
            imgUrl = 'https://s3.damoang.net' + imgUrl;
        }
        return imgUrl;
    }
    return null;
}

const celebrationCache = createCache<CelebrationBanner[]>({ ttl: 60_000, maxSize: 10 });

/**
 * 축하메시지 조회
 * @param isRecent true면 날짜 무관 최근 8건, false면 오늘만
 */
export async function fetchCelebrations(isRecent: boolean = false): Promise<CelebrationBanner[]> {
    const banners: CelebrationBanner[] = [];

    // 1차: celebration_banners 테이블 (신규)
    try {
        const dateFilter = isRecent
            ? ''
            : "AND cb.display_date = DATE(CONVERT_TZ(NOW(), '+00:00', '+09:00'))";
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT cb.id, cb.title, cb.content, cb.image_url, cb.link_url,
					cb.external_url, cb.display_date, cb.target_member_id,
					cb.link_target, cb.sort_order, cb.display_type,
					cb.source_wr_id,
					m.mb_nick AS target_member_nick,
					m.mb_image_url AS target_member_image_url
			 FROM celebration_banners cb
			 LEFT JOIN g5_member m ON cb.target_member_id = m.mb_id
			 WHERE cb.is_active = 1 ${dateFilter}
			 ORDER BY cb.display_date DESC, cb.sort_order ASC, cb.id DESC
			 LIMIT 8`
        );

        for (const row of rows as RowDataPacket[]) {
            const linkUrl =
                row.external_url ||
                (row.source_wr_id ? `/message/${row.source_wr_id}` : row.link_url || '');

            banners.push({
                id: row.source_wr_id || row.id,
                title: row.title,
                content: row.content || '',
                image_url: row.image_url || '',
                link_url: linkUrl,
                display_date: row.display_date,
                is_active: true,
                target_member_id: row.target_member_id || undefined,
                target_member_nick: row.target_member_nick || undefined,
                target_member_photo: getMemberPhotoUrl(row.target_member_image_url),
                external_link: row.external_url || undefined,
                link_target: row.link_target || '_blank',
                sort_order: row.sort_order || 0,
                display_type: row.display_type || 'image'
            });
        }
    } catch {
        // celebration_banners 테이블이 없을 수 있음
    }

    // 2차: g5_write_message fallback (마이그레이션 전까지)
    if (banners.length === 0) {
        const legacyDateFilter = isRecent
            ? ''
            : "AND (wm.wr_subject = DATE_FORMAT(CONVERT_TZ(NOW(),'+00:00','+09:00'),'%Y.%m.%d') OR wm.wr_subject = DATE_FORMAT(CONVERT_TZ(NOW(),'+00:00','+09:00'),'%Y-%m-%d'))";
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT wm.wr_id, wm.wr_subject, wm.wr_content, wm.wr_link2, wm.mb_id,
					m.mb_nick, m.mb_image_url
			 FROM g5_write_message wm
			 LEFT JOIN g5_member m ON wm.mb_id = m.mb_id
			 WHERE wm.wr_is_comment = 0 ${legacyDateFilter}
			 ORDER BY wm.wr_id DESC
			 LIMIT 8`
        );

        for (const row of rows as RowDataPacket[]) {
            const imageUrl = extractFirstImage(row.wr_content);
            if (imageUrl) {
                banners.push({
                    id: row.wr_id,
                    title: row.wr_subject,
                    content: row.wr_content,
                    image_url: imageUrl,
                    link_url: row.wr_link2 || `/message/${row.wr_id}`,
                    display_date: row.wr_subject,
                    is_active: true,
                    target_member_id: row.mb_id || undefined,
                    target_member_nick: row.mb_nick || undefined,
                    target_member_photo: getMemberPhotoUrl(row.mb_image_url),
                    external_link: row.wr_link2 || undefined,
                    display_type: 'image'
                });
            }
        }
    }

    return banners;
}

/** 캐시된 축하메시지 조회 (60초 TTL, singleflight) */
export async function getCachedCelebrations(
    isRecent: boolean = false
): Promise<CelebrationBanner[]> {
    const cacheKey = isRecent ? 'recent' : 'today';
    return celebrationCache.getOrSet(cacheKey, () => fetchCelebrations(isRecent));
}
