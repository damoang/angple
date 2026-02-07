/**
 * 이미지+텍스트 배너 API
 * g5_write_banners 테이블에서 활성 배너를 조회합니다.
 *
 * - wr_10: 이미지 URL (S3 또는 로컬 경로)
 * - wr_link1: 링크 URL
 * - wr_subject: 배너 텍스트 (alt)
 * - wr_4: 시작일 (빈 값이면 제한 없음)
 * - wr_5: 종료일 (빈 값이면 제한 없음)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface BannerRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    wr_link1: string;
    wr_10: string;
    wr_4: string;
    wr_5: string;
    bf_file?: string;
}

interface BannerItem {
    id: number;
    image: string;
    link: string;
    text: string;
}

/**
 * 이미지 경로를 정규화합니다.
 * - S3 URL은 그대로
 * - 상대 경로(./data/...)는 S3 URL로 변환
 * - /data/... 경로는 S3 URL로 변환
 */
function normalizeImageUrl(url: string): string {
    if (!url) return '';

    // 이미 S3 URL인 경우
    if (url.startsWith('https://s3.damoang.net/')) return url;
    if (url.startsWith('http')) return url;

    // 상대 경로 정규화
    let path = url;
    if (path.startsWith('./')) path = path.slice(2);
    if (!path.startsWith('/')) path = '/' + path;

    return `https://s3.damoang.net${path}`;
}

export const GET: RequestHandler = async ({ url }) => {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '4'), 8);

    try {
        const now = new Date();
        const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 배너 조회: 이미지가 있거나 첨부파일이 있는 배너
        const [rows] = await pool.query<BannerRow[]>(
            `SELECT b.wr_id, b.wr_subject, b.wr_link1, b.wr_10, b.wr_4, b.wr_5,
			        (SELECT bf_file FROM g5_board_file WHERE bo_table = 'banners' AND wr_id = b.wr_id AND bf_file != '' ORDER BY bf_no LIMIT 1) as bf_file
			 FROM g5_write_banners b
			 WHERE b.wr_is_comment = 0
			   AND (b.wr_10 != '' OR EXISTS (
			     SELECT 1 FROM g5_board_file WHERE bo_table = 'banners' AND wr_id = b.wr_id AND bf_file != ''
			   ))
			 ORDER BY b.wr_id DESC`
        );

        // 기간 필터링 + 이미지 URL 정규화
        const banners: BannerItem[] = [];

        for (const row of rows) {
            // 시작일 체크
            if (row.wr_4 && nowStr < row.wr_4) continue;
            // 종료일 체크
            if (row.wr_5 && nowStr > row.wr_5) continue;

            // 이미지 결정: wr_10 우선, 없으면 첨부파일
            let image = row.wr_10 || '';
            if (!image && row.bf_file) {
                image = `/data/file/banners/${row.bf_file}`;
            }
            if (!image) continue;

            banners.push({
                id: row.wr_id,
                image: normalizeImageUrl(image),
                link: row.wr_link1 || '',
                text: row.wr_subject || ''
            });
        }

        // 랜덤 셔플
        for (let i = banners.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [banners[i], banners[j]] = [banners[j], banners[i]];
        }

        return json({
            success: true,
            data: banners.slice(0, limit)
        });
    } catch (error) {
        console.error('Banner API error:', error);
        return json(
            { success: false, data: [], error: 'Failed to fetch banners' },
            { status: 500 }
        );
    }
};
