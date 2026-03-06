/**
 * 앱 초기화 API — 여러 공통 데이터를 서버에서 병렬 조회하여 단일 응답으로 반환
 *
 * GET /api/init?positions=index,board-list,sidebar
 * → { celebration: [...], banners: { index: [...], sidebar: [...] } }
 *
 * 클라이언트에서 celebration + banners를 각각 호출하던 것을 1회로 통합
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { createCache } from '$lib/server/cache';
import { getAdsServerUrl } from '$lib/server/ads/config';

interface CelebrationBanner {
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

const celebrationCache = createCache<CelebrationBanner[]>({ ttl: 60_000, maxSize: 2 });

async function fetchCelebrations(): Promise<CelebrationBanner[]> {
    const banners: CelebrationBanner[] = [];

    try {
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT cb.id, cb.title, cb.content, cb.image_url, cb.link_url,
					cb.external_url, cb.display_date, cb.target_member_id,
					cb.link_target, cb.sort_order, cb.display_type,
					cb.source_wr_id,
					m.mb_nick AS target_member_nick,
					m.mb_image_url AS target_member_image_url
			 FROM celebration_banners cb
			 LEFT JOIN g5_member m ON cb.target_member_id COLLATE utf8mb4_unicode_ci = m.mb_id
			 WHERE cb.is_active = 1
			   AND cb.display_date = DATE(CONVERT_TZ(NOW(), '+00:00', '+09:00'))
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

    if (banners.length === 0) {
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT wm.wr_id, wm.wr_subject, wm.wr_content, wm.wr_link2, wm.mb_id,
					m.mb_nick, m.mb_image_url
			 FROM g5_write_message wm
			 LEFT JOIN g5_member m ON wm.mb_id = m.mb_id
			 WHERE wm.wr_is_comment = 0
			   AND (wm.wr_subject = DATE_FORMAT(CONVERT_TZ(NOW(),'+00:00','+09:00'),'%Y.%m.%d') OR wm.wr_subject = DATE_FORMAT(CONVERT_TZ(NOW(),'+00:00','+09:00'),'%Y-%m-%d'))
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBannersByPositions(positions: string[]): Promise<Record<string, any>> {
    const adsServerUrl = getAdsServerUrl();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    await Promise.all(
        positions.map(async (position) => {
            try {
                const response = await fetch(
                    `${adsServerUrl}/api/v1/serve/banners?position=${encodeURIComponent(position)}&limit=10`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.banners) {
                        result[position] = data.data.banners;
                    }
                }
            } catch {
                // 개별 position 실패는 무시
            }
        })
    );

    return result;
}

export const GET: RequestHandler = async ({ url }) => {
    const positionsParam = url.searchParams.get('positions') || '';
    const positions = positionsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    try {
        const [celebration, banners] = await Promise.all([
            celebrationCache.getOrSet('today', fetchCelebrations),
            positions.length > 0 ? fetchBannersByPositions(positions) : {}
        ]);

        return json(
            { celebration, banners },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
                }
            }
        );
    } catch (error) {
        console.error('Init API error:', error);
        return json({ celebration: [], banners: {} }, { status: 500 });
    }
};
