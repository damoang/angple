/**
 * 나눔 API
 * 진행중/종료 나눔 목록을 반환합니다.
 *
 * 쿼리 파라미터:
 * - tab: 'active' | 'ended' (기본: active)
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 개수 (기본: 20, 최대: 40)
 * - sort: 'urgent' | 'newest' (기본: urgent, active 탭 전용)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface GivingRow extends RowDataPacket {
	wr_id: number;
	wr_subject: string;
	wr_name: string;
	wr_datetime: string;
	wr_hit: number;
	wr_good: number;
	wr_comment: number;
	wr_2: string; // 포인트/숫자
	wr_3: string; // 상품명
	wr_4: string; // 시작일시
	wr_5: string; // 종료일시
	wr_6: string; // 배송유형
	wr_7: string; // 일시정지
	wr_10: string; // 썸네일
}

interface BidRow extends RowDataPacket {
	wr_id: number;
	unique_participants: number;
}

interface FileRow extends RowDataPacket {
	wr_id: number;
	bf_file: string;
}

interface CountRow extends RowDataPacket {
	cnt: number;
}

export const GET: RequestHandler = async ({ url }) => {
	const tab = url.searchParams.get('tab') || 'active';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 40);
	const sort = url.searchParams.get('sort') || 'urgent';
	const offset = (page - 1) * limit;

	try {
		const now = new Date();
		const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

		let whereClause: string;
		let orderClause: string;
		const params: (string | number)[] = [];

		if (tab === 'ended') {
			// 종료된 나눔: 종료시간 지남 OR 강제종료
			whereClause = `wr_is_comment = 0 AND (
				(wr_5 != '' AND wr_5 <= ?)
				OR wr_7 = '2'
			)`;
			params.push(nowStr);
			orderClause = 'ORDER BY wr_datetime DESC';
		} else {
			// 진행중 나눔: 시작됨 + 종료 안됨 + 정지 아님
			whereClause = `wr_is_comment = 0
				AND (wr_5 = '' OR wr_5 > ?)
				AND (wr_4 = '' OR wr_4 <= ?)
				AND (wr_7 IS NULL OR wr_7 = '' OR wr_7 = '0')`;
			params.push(nowStr, nowStr);

			if (sort === 'urgent') {
				orderClause = `ORDER BY
					CASE WHEN wr_5 != '' THEN wr_5 END ASC,
					wr_datetime DESC`;
			} else {
				orderClause = 'ORDER BY wr_datetime DESC';
			}
		}

		// 전체 개수 조회
		const [countRows] = await pool.query<CountRow[]>(
			`SELECT COUNT(*) as cnt FROM g5_write_giving WHERE ${whereClause}`,
			params
		);
		const total = countRows[0]?.cnt || 0;

		// 목록 조회
		const [rows] = await pool.query<GivingRow[]>(
			`SELECT wr_id, wr_subject, wr_name, wr_datetime, wr_hit, wr_good, wr_comment,
			        wr_2, wr_3, wr_4, wr_5, wr_6, wr_7, wr_10
			 FROM g5_write_giving
			 WHERE ${whereClause}
			 ${orderClause}
			 LIMIT ? OFFSET ?`,
			[...params, limit, offset]
		);

		if (!rows || rows.length === 0) {
			return json({
				success: true,
				data: [],
				pagination: { page, total, totalPages: Math.ceil(total / limit), limit }
			});
		}

		// 참여자 수 조회
		const wrIds = rows.map((r) => r.wr_id);
		const [bidRows] = await pool.query<BidRow[]>(
			`SELECT wr_id, COUNT(DISTINCT mb_id) as unique_participants
			 FROM g5_giving_bid
			 WHERE wr_id IN (?) AND bid_status = 'active'
			 GROUP BY wr_id`,
			[wrIds]
		);

		// 첨부 파일 조회 (썸네일용)
		const [fileRows] = await pool.query<FileRow[]>(
			`SELECT wr_id, bf_file
			 FROM g5_board_file
			 WHERE bo_table = 'giving' AND wr_id IN (?) AND bf_file != ''
			 ORDER BY bf_no`,
			[wrIds]
		);

		// 참여자 수 맵 생성
		const participantsMap = new Map<number, number>();
		if (bidRows) {
			for (const row of bidRows as BidRow[]) {
				participantsMap.set(row.wr_id, row.unique_participants);
			}
		}

		// 파일 맵 생성 (첫 번째 파일만)
		const fileMap = new Map<number, string>();
		if (fileRows) {
			for (const row of fileRows as FileRow[]) {
				if (!fileMap.has(row.wr_id)) {
					fileMap.set(row.wr_id, row.bf_file);
				}
			}
		}

		// 결과 변환 (FreePost 호환 형태)
		const data = rows.map((row) => {
			const endTime = row.wr_5 ? new Date(row.wr_5) : null;
			const isUrgent = endTime
				? endTime.getTime() - now.getTime() <= 24 * 60 * 60 * 1000 && endTime.getTime() > now.getTime()
				: false;

			// 썸네일 처리
			let thumbnail = row.wr_10 || '';
			if (!thumbnail) {
				const fileUrl = fileMap.get(row.wr_id);
				if (fileUrl) {
					thumbnail = `https://damoang.net/data/file/giving/${fileUrl}`;
				}
			}

			// S3 URL인 경우 Lambda 썸네일 URL로 변환
			if (thumbnail && thumbnail.includes('s3.damoang.net')) {
				const match = thumbnail.match(
					/^(https?:\/\/s3\.damoang\.net\/.+\/)([^/]+)\.([a-zA-Z0-9]+)$/
				);
				if (match) {
					thumbnail = `${match[1]}${match[2]}-400x225.webp`;
				}
			}

			return {
				id: row.wr_id,
				title: row.wr_subject,
				content: '',
				author: row.wr_name,
				author_id: '',
				views: row.wr_hit || 0,
				likes: row.wr_good || 0,
				comments_count: row.wr_comment || 0,
				created_at: row.wr_datetime,
				thumbnail,
				extra_2: row.wr_2,
				extra_3: row.wr_3,
				extra_4: row.wr_4,
				extra_5: row.wr_5,
				extra_6: row.wr_6,
				extra_7: row.wr_7,
				extra_10: row.wr_10 || thumbnail,
				participant_count: String(participantsMap.get(row.wr_id) || 0),
				is_urgent: isUrgent
			};
		});

		return json({
			success: true,
			data,
			pagination: {
				page,
				total,
				totalPages: Math.ceil(total / limit),
				limit
			}
		});
	} catch (error) {
		console.error('Giving API error:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch giving data'
			},
			{ status: 500 }
		);
	}
};
