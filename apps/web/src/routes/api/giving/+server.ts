/**
 * 나눔 API
 * 진행중인 나눔 목록을 반환합니다.
 *
 * 추후 angple-ads 프로젝트 API로 통합 예정
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface GivingRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    wr_10: string; // 썸네일
    wr_4: string; // 시작일시
    wr_5: string; // 종료일시
    wr_7: string; // 일시정지
}

interface BidRow extends RowDataPacket {
    wr_id: number;
    unique_participants: number;
}

interface FileRow extends RowDataPacket {
    wr_id: number;
    bf_file: string;
}

interface GivingItem {
    id: number;
    title: string;
    thumbnail: string;
    link: string;
    participants: number;
    end_time: string;
    is_urgent: boolean;
}

export const GET: RequestHandler = async ({ url }) => {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '8'), 8);

    try {
        const now = new Date();
        const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

        // 진행중인 나눔 조회
        // wr_4: 시작일시, wr_5: 종료일시, wr_7: 일시정지 (0 = 정상, 1 = 일시정지)
        const [rows] = await pool.query<GivingRow[]>(
            `SELECT wr_id, wr_subject, wr_10, wr_4, wr_5, wr_7
             FROM g5_write_giving
             WHERE wr_is_comment = 0
               AND (wr_5 = '' OR wr_5 > ?)
               AND (wr_4 = '' OR wr_4 <= ?)
               AND (wr_7 IS NULL OR wr_7 = '' OR wr_7 = '0')
             ORDER BY
               CASE WHEN wr_5 != '' THEN wr_5 END ASC,
               wr_datetime DESC
             LIMIT ?`,
            [nowStr, nowStr, limit]
        );

        if (!rows || rows.length === 0) {
            return json({
                success: true,
                data: []
            });
        }

        // 참여자 수 조회
        const wrIds = rows.map((r: GivingRow) => r.wr_id);
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

        // 결과 변환
        const data: GivingItem[] = rows.map((row: GivingRow) => {
            const endTime = row.wr_5 ? new Date(row.wr_5) : null;
            const isUrgent = endTime
                ? endTime.getTime() - now.getTime() <= 24 * 60 * 60 * 1000
                : false;

            // 썸네일 처리: wr_10 우선, 없으면 첨부파일
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
                thumbnail,
                link: `/giving/${row.wr_id}`,
                participants: participantsMap.get(row.wr_id) || 0,
                end_time: row.wr_5,
                is_urgent: isUrgent
            };
        });

        return json({
            success: true,
            data
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
