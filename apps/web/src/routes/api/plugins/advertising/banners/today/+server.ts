/**
 * 축하메시지 배너 API
 * g5_write_message 테이블에서 오늘 날짜 게시물 조회
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
}

/**
 * 본문에서 첫 번째 이미지 URL 추출
 */
function extractFirstImage(content: string): string | null {
	if (!content) return null;

	// <img src="..."> 패턴 매칭
	const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
	if (imgMatch && imgMatch[1]) {
		let imgUrl = imgMatch[1];
		// CDN 호스트 변환
		if (imgUrl.startsWith('/data/')) {
			imgUrl = 'https://s3.damoang.net' + imgUrl;
		}
		return imgUrl;
	}

	return null;
}

export const GET: RequestHandler = async () => {
	try {
		// 오늘 날짜 (Y.m.d 및 Y-m-d 형식)
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const dateDot = `${year}.${month}.${day}`;
		const dateDash = `${year}-${month}-${day}`;

		// g5_write_message 테이블에서 오늘 날짜 게시물 조회
		const [rows] = await pool.execute<RowDataPacket[]>(
			`SELECT wr_id, wr_subject, wr_content, wr_link2, mb_id
			 FROM g5_write_message
			 WHERE wr_is_comment = 0
			 AND (wr_subject = ? OR wr_subject = ?)
			 ORDER BY wr_id DESC`,
			[dateDot, dateDash]
		);

		const banners: Banner[] = [];

		for (const row of rows as RowDataPacket[]) {
			const imageUrl = extractFirstImage(row.wr_content);

			// 이미지가 있는 게시물만 추가
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
					target_member_nick: undefined,
					target_member_photo: undefined,
					external_link: row.wr_link2 || undefined
				});
			}
		}

		return json({
			success: true,
			data: banners
		});
	} catch (error) {
		console.error('Banner API error:', error);
		return json({
			success: false,
			data: [],
			error: 'Failed to fetch banners'
		}, { status: 500 });
	}
};
