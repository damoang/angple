/**
 * 나눔 응모 API
 * POST /api/giving/[id]/bid - 응모 생성
 * GET  /api/giving/[id]/bid - 내 응모 현황
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { parseBidNumbers } from '$lib/types/giving.js';

interface PostRow extends RowDataPacket {
	wr_id: number;
	wr_2: string; // 번호당 포인트
	wr_4: string; // 시작일시
	wr_5: string; // 종료일시
	wr_7: string; // 상태
	mb_id: string; // 글작성자 ID
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const postId = parseInt(params.id);
	if (isNaN(postId)) {
		return json({ success: false, error: 'Invalid post ID' }, { status: 400 });
	}

	const user = await getAuthUser(cookies);
	if (!user) {
		return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const numbersInput = body.numbers as string;
		if (!numbersInput) {
			return json({ success: false, error: '번호를 입력해주세요.' }, { status: 400 });
		}

		const numbers = parseBidNumbers(numbersInput);
		if (numbers.length === 0) {
			return json({ success: false, error: '유효한 번호가 없습니다.' }, { status: 400 });
		}

		if (numbers.length > 100) {
			return json({ success: false, error: '한 번에 최대 100개 번호까지 응모 가능합니다.' }, { status: 400 });
		}

		// 나눔 게시글 확인
		const [postRows] = await pool.query<PostRow[]>(
			`SELECT wr_id, wr_2, wr_4, wr_5, wr_7, mb_id
			 FROM g5_write_giving
			 WHERE wr_id = ? AND wr_is_comment = 0`,
			[postId]
		);

		if (!postRows[0]) {
			return json({ success: false, error: '나눔을 찾을 수 없습니다.' }, { status: 404 });
		}

		const post = postRows[0];

		// 상태 확인
		if (post.wr_7 === '1' || post.wr_7 === '2') {
			return json({ success: false, error: '이 나눔은 현재 응모할 수 없습니다.' }, { status: 400 });
		}

		const now = new Date();
		if (post.wr_5 && new Date(post.wr_5) <= now) {
			return json({ success: false, error: '종료된 나눔입니다.' }, { status: 400 });
		}

		if (post.wr_4 && new Date(post.wr_4) > now) {
			return json({ success: false, error: '아직 시작되지 않은 나눔입니다.' }, { status: 400 });
		}

		// 번호당 포인트
		const pointsPerNumber = parseInt(post.wr_2 || '0', 10);
		const totalPoints = numbers.length * pointsPerNumber;

		// 사용자 포인트 확인
		const [pointRows] = await pool.query<RowDataPacket[]>(
			`SELECT mb_point FROM g5_member WHERE mb_id = ?`,
			[user.mb_id]
		);

		const currentPoints = pointRows[0]?.mb_point ?? 0;
		if (currentPoints < totalPoints) {
			return json({
				success: false,
				error: `포인트가 부족합니다. (필요: ${totalPoints.toLocaleString()}, 보유: ${currentPoints.toLocaleString()})`
			}, { status: 400 });
		}

		// 중복 번호 체크 (이미 응모한 번호)
		const [existingNumbers] = await pool.query<RowDataPacket[]>(
			`SELECT bid_number
			 FROM g5_giving_bid_numbers
			 WHERE wr_id = ? AND mb_id = ? AND bid_status = 'active' AND bid_number IN (?)`,
			[postId, user.mb_id, numbers]
		);

		if (existingNumbers && existingNumbers.length > 0) {
			const dupes = existingNumbers.map((r: RowDataPacket) => r.bid_number).join(', ');
			return json({
				success: false,
				error: `이미 응모한 번호가 있습니다: ${dupes}`
			}, { status: 400 });
		}

		// 트랜잭션으로 응모 처리
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();

			// 1. 응모 레코드 생성
			const [bidResult] = await connection.query(
				`INSERT INTO g5_giving_bid (wr_id, mb_id, mb_nick, bid_numbers, bid_count, bid_points, bid_datetime, bid_status)
				 VALUES (?, ?, ?, ?, ?, ?, NOW(), 'active')`,
				[postId, user.mb_id, user.mb_name, numbersInput, numbers.length, totalPoints]
			);

			const bidId = (bidResult as { insertId: number }).insertId;

			// 2. 개별 번호 레코드 생성
			const numberValues = numbers.map((n) => [postId, bidId, user.mb_id, n, 'active']);
			await connection.query(
				`INSERT INTO g5_giving_bid_numbers (wr_id, bid_id, mb_id, bid_number, bid_status)
				 VALUES ?`,
				[numberValues]
			);

			// 3. 포인트 차감 (응모자)
			await connection.query(
				`UPDATE g5_member SET mb_point = mb_point - ? WHERE mb_id = ?`,
				[totalPoints, user.mb_id]
			);

			// 4. 포인트 내역 기록 (응모자 차감)
			await connection.query(
				`INSERT INTO g5_point (mb_id, po_content, po_point, po_datetime, po_rel_table, po_rel_id, po_rel_action)
				 VALUES (?, ?, ?, NOW(), 'giving', ?, 'bid')`,
				[user.mb_id, `나눔 응모 (${numbers.length}개 번호)`, -totalPoints, String(postId)]
			);

			// 5. 수수료 50%: 글작성자에게 포인트 지급
			if (post.mb_id && post.mb_id !== user.mb_id) {
				const authorPoints = Math.floor(totalPoints * 0.5);
				if (authorPoints > 0) {
					await connection.query(
						`UPDATE g5_member SET mb_point = mb_point + ? WHERE mb_id = ?`,
						[authorPoints, post.mb_id]
					);

					await connection.query(
						`INSERT INTO g5_point (mb_id, po_content, po_point, po_datetime, po_rel_table, po_rel_id, po_rel_action)
						 VALUES (?, ?, ?, NOW(), 'giving', ?, 'bid_commission')`,
						[post.mb_id, `나눔 응모 수수료`, authorPoints, String(postId)]
					);
				}
			}

			await connection.commit();

			return json({
				success: true,
				data: {
					bid_id: bidId,
					numbers: numbers,
					points_used: totalPoints
				}
			});
		} catch (err) {
			await connection.rollback();
			throw err;
		} finally {
			connection.release();
		}
	} catch (error) {
		console.error('Giving bid API error:', error);
		return json(
			{ success: false, error: '응모 처리 중 오류가 발생했습니다.' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ params, cookies }) => {
	const postId = parseInt(params.id);
	if (isNaN(postId)) {
		return json({ success: false, error: 'Invalid post ID' }, { status: 400 });
	}

	const user = await getAuthUser(cookies);
	if (!user) {
		return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
	}

	try {
		const [bids] = await pool.query<RowDataPacket[]>(
			`SELECT bid_id, mb_id, mb_nick, bid_numbers, bid_count, bid_points, bid_datetime
			 FROM g5_giving_bid
			 WHERE wr_id = ? AND mb_id = ? AND bid_status = 'active'
			 ORDER BY bid_datetime DESC`,
			[postId, user.mb_id]
		);

		return json({
			success: true,
			data: bids || []
		});
	} catch (error) {
		console.error('Giving bid GET error:', error);
		return json(
			{ success: false, error: 'Failed to fetch bids' },
			{ status: 500 }
		);
	}
};
