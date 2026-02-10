/**
 * 축하메시지 배너 API
 * 1차: celebration_banners 테이블 (신규 단일 소스)
 * 2차: g5_write_message 테이블 (레거시 fallback — 마이그레이션 전까지)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface Banner {
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
}

/**
 * 본문에서 첫 번째 이미지 URL 추출 (g5_write_message 용)
 */
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

export const GET: RequestHandler = async () => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const dateDash = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateDot = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;

        const banners: Banner[] = [];

        // 1차: celebration_banners 테이블 (신규)
        try {
            const [rows] = await pool.execute<RowDataPacket[]>(
                `SELECT id, title, content, image_url, link_url, external_url,
                        display_date, target_member_id, link_target, sort_order
                 FROM celebration_banners
                 WHERE is_active = 1
                   AND (display_date = ?
                        OR (yearly_repeat = 1 AND MONTH(display_date) = ? AND DAY(display_date) = ?))
                 ORDER BY sort_order ASC, id DESC`,
                [dateDash, month, day]
            );

            for (const row of rows as RowDataPacket[]) {
                banners.push({
                    id: row.id,
                    title: row.title,
                    content: row.content || '',
                    image_url: row.image_url || '',
                    link_url: row.link_url || '',
                    display_date: row.display_date,
                    is_active: true,
                    target_member_id: row.target_member_id || undefined,
                    external_link: row.external_url || undefined,
                    link_target: row.link_target || '_blank',
                    sort_order: row.sort_order || 0
                });
            }
        } catch {
            // celebration_banners 테이블이 없을 수 있음 — 무시하고 fallback으로
        }

        // 2차: g5_write_message fallback (마이그레이션 전까지)
        if (banners.length === 0) {
            const [rows] = await pool.execute<RowDataPacket[]>(
                `SELECT wr_id, wr_subject, wr_content, wr_link2, mb_id
                 FROM g5_write_message
                 WHERE wr_is_comment = 0
                   AND (wr_subject = ? OR wr_subject = ?)
                 ORDER BY wr_id DESC`,
                [dateDot, dateDash]
            );

            for (const row of rows as RowDataPacket[]) {
                const imageUrl = extractFirstImage(row.wr_content);
                if (imageUrl) {
                    banners.push({
                        id: row.wr_id,
                        title: row.wr_subject,
                        content: row.wr_content,
                        image_url: imageUrl,
                        link_url: `/message/${row.wr_id}`,
                        display_date: row.wr_subject,
                        is_active: true,
                        target_member_id: row.mb_id || undefined,
                        external_link: row.wr_link2 || undefined
                    });
                }
            }
        }

        return json({
            success: true,
            data: banners
        });
    } catch (error) {
        console.error('Banner API error:', error);
        return json(
            {
                success: false,
                data: [],
                error: 'Failed to fetch banners'
            },
            { status: 500 }
        );
    }
};
