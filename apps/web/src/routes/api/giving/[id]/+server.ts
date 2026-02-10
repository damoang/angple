/**
 * 나눔 상세 API
 * GET /api/giving/[id]
 * 나눔 상세 정보 + 응모 통계 + 당첨자 정보
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

interface BidRow extends RowDataPacket {
    bid_id: number;
    mb_id: string;
    mb_nick: string;
    bid_numbers: string;
    bid_count: number;
    bid_points: number;
    bid_datetime: string;
}

interface StatsRow extends RowDataPacket {
    unique_participants: number;
    total_bid_count: number;
}

interface NumberCountRow extends RowDataPacket {
    bid_number: number;
    cnt: number;
}

export const GET: RequestHandler = async ({ params, cookies }) => {
    const postId = parseInt(params.id);
    if (isNaN(postId)) {
        return json({ success: false, error: 'Invalid post ID' }, { status: 400 });
    }

    try {
        // 응모 통계
        const [statsRows] = await pool.query<StatsRow[]>(
            `SELECT
				COUNT(DISTINCT mb_id) as unique_participants,
				SUM(bid_count) as total_bid_count
			 FROM g5_giving_bid
			 WHERE wr_id = ? AND bid_status = 'active'`,
            [postId]
        );

        const stats = statsRows[0] || { unique_participants: 0, total_bid_count: 0 };

        // 현재 사용자의 응모 현황
        let myBids: BidRow[] = [];
        const user = await getAuthUser(cookies);
        if (user) {
            const [userBids] = await pool.query<BidRow[]>(
                `SELECT bid_id, mb_id, mb_nick, bid_numbers, bid_count, bid_points, bid_datetime
				 FROM g5_giving_bid
				 WHERE wr_id = ? AND mb_id = ? AND bid_status = 'active'
				 ORDER BY bid_datetime DESC`,
                [postId, user.mb_id]
            );
            myBids = userBids || [];
        }

        // 나눔 종료 여부 확인 → 당첨자 계산
        let winner = null;
        const [postRows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_5, wr_7 FROM g5_write_giving WHERE wr_id = ?`,
            [postId]
        );

        if (postRows[0]) {
            const { wr_5, wr_7 } = postRows[0];
            const isEnded = wr_7 === '2' || (wr_5 && new Date(wr_5) <= new Date());

            if (isEnded) {
                // 최저고유번호 당첨 로직
                // 1. 모든 응모 번호를 풀어서 개별 번호별 카운트
                const [numberCounts] = await pool.query<NumberCountRow[]>(
                    `SELECT bid_number, COUNT(*) as cnt
					 FROM g5_giving_bid_numbers
					 WHERE wr_id = ? AND bid_status = 'active'
					 ORDER BY bid_number ASC`,
                    [postId]
                );

                // 2. 고유번호 (1번만 선택된 번호) 중 최저 찾기
                const uniqueNumbers = (numberCounts || []).filter((r) => r.cnt === 1);
                if (uniqueNumbers.length > 0) {
                    const winningNumber = uniqueNumbers[0].bid_number;

                    // 3. 해당 번호를 응모한 사용자 찾기
                    const [winnerRows] = await pool.query<RowDataPacket[]>(
                        `SELECT b.mb_id, b.mb_nick
						 FROM g5_giving_bid_numbers bn
						 JOIN g5_giving_bid b ON bn.bid_id = b.bid_id
						 WHERE bn.wr_id = ? AND bn.bid_number = ? AND bn.bid_status = 'active'
						 LIMIT 1`,
                        [postId, winningNumber]
                    );

                    if (winnerRows[0]) {
                        winner = {
                            mb_id: winnerRows[0].mb_id,
                            mb_nick: winnerRows[0].mb_nick,
                            winning_number: winningNumber
                        };
                    }
                }
            }
        }

        return json({
            success: true,
            data: {
                totalParticipants: stats.unique_participants || 0,
                totalBidCount: stats.total_bid_count || 0,
                myBids,
                winner
            }
        });
    } catch (error) {
        console.error('Giving detail API error:', error);
        return json({ success: false, error: 'Failed to fetch giving detail' }, { status: 500 });
    }
};
