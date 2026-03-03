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
    display_type: 'image' | 'text';
}

/**
 * 회원 프로필 이미지 URL 생성
 */
function getMemberPhotoUrl(mbImageUrl: string | null | undefined): string | undefined {
    if (!mbImageUrl) return undefined;
    return `https://s3.damoang.net/${mbImageUrl}`;
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
        const banners: Banner[] = [];

        // 1차: celebration_banners 테이블 (신규) — 최근 활성 배너를 날짜 무관하게 표시
        try {
            const [rows] = await pool.execute<RowDataPacket[]>(
                `SELECT cb.id, cb.title, cb.content, cb.image_url, cb.link_url,
                        cb.external_url, cb.display_date, cb.target_member_id,
                        cb.link_target, cb.sort_order, cb.display_type,
                        m.mb_nick AS target_member_nick,
                        m.mb_image_url AS target_member_image_url
                 FROM celebration_banners cb
                 LEFT JOIN g5_member m ON cb.target_member_id = m.mb_id
                 WHERE cb.is_active = 1
                 ORDER BY cb.display_date DESC, cb.sort_order ASC, cb.id DESC
                 LIMIT 8`
            );

            for (const row of rows as RowDataPacket[]) {
                banners.push({
                    id: row.id,
                    title: row.title,
                    content: row.content || '',
                    image_url: row.image_url || '',
                    link_url:
                        row.link_url && row.link_url.includes('/free/5632568')
                            ? `/message/${row.id}`
                            : row.link_url || '',
                    display_date: row.display_date,
                    is_active: true,
                    target_member_id: row.target_member_id || undefined,
                    target_member_nick: row.target_member_nick || undefined,
                    target_member_photo: getMemberPhotoUrl(row.target_member_image_url),
                    external_link:
                        row.external_url && !row.external_url.includes('/free/5632568')
                            ? row.external_url
                            : undefined,
                    link_target: row.link_target || '_blank',
                    sort_order: row.sort_order || 0,
                    display_type: row.display_type || 'image'
                });
            }
        } catch {
            // celebration_banners 테이블이 없을 수 있음 — 무시하고 fallback으로
        }

        // 2차: g5_write_message fallback (마이그레이션 전까지) — 최근 글 표시
        if (banners.length === 0) {
            const [rows] = await pool.execute<RowDataPacket[]>(
                `SELECT wm.wr_id, wm.wr_subject, wm.wr_content, wm.wr_link2, wm.mb_id,
                        m.mb_nick, m.mb_image_url
                 FROM g5_write_message wm
                 LEFT JOIN g5_member m ON wm.mb_id = m.mb_id
                 WHERE wm.wr_is_comment = 0
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
                        link_url: `/message/${row.wr_id}`,
                        display_date: row.wr_subject,
                        is_active: true,
                        target_member_id: row.mb_id || undefined,
                        target_member_nick: row.mb_nick || undefined,
                        target_member_photo: getMemberPhotoUrl(row.mb_image_url),
                        external_link:
                            row.wr_link2 && !row.wr_link2.includes('/free/5632568')
                                ? row.wr_link2
                                : undefined,
                        display_type: 'image'
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
