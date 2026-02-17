/**
 * 마이그레이션 실행 API
 *
 * POST /api/admin/migration/run
 *
 * 실제 마이그레이션을 실행합니다.
 * 현재는 dry-run 모드에서 통계만 반환합니다.
 * 실제 쓰기는 @angple/migration 패키지의 migrateGnuboard/migrateRhymix를 호출합니다.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { source, sourceDb, targetDb, dryRun } = body;

        console.log(
            `🚀 [Migration] ${source} 마이그레이션 ${dryRun ? '시뮬레이션' : '실행'} 시작`
        );

        const startedAt = new Date();

        // Dry-run: 분석 결과를 기반으로 예상 통계 반환
        // 실제 모드: @angple/migration 패키지 호출 (mysql2 연결 필요)
        if (dryRun) {
            const mysql = await import('mysql2/promise');
            const prefix = body.tablePrefix || (source === 'gnuboard' ? 'g5_' : 'xe_');

            const conn = await mysql.createConnection({
                host: sourceDb.host,
                port: sourceDb.port || 3306,
                user: sourceDb.user,
                password: sourceDb.password,
                database: sourceDb.database,
                connectTimeout: 10000
            });

            try {
                const stats: Record<string, { total: number; migrated: number; skipped: number }> =
                    {
                        members: { total: 0, migrated: 0, skipped: 0 },
                        boards: { total: 0, migrated: 0, skipped: 0 },
                        boardGroups: { total: 0, migrated: 0, skipped: 0 },
                        posts: { total: 0, migrated: 0, skipped: 0 },
                        comments: { total: 0, migrated: 0, skipped: 0 },
                        points: { total: 0, migrated: 0, skipped: 0 },
                        attachments: { total: 0, migrated: 0, skipped: 0 }
                    };

                if (source === 'gnuboard') {
                    const [m] = await conn.query(
                        `SELECT COUNT(*) as cnt FROM ${prefix}member`
                    );
                    stats.members.total = (m as any)[0].cnt;
                    stats.members.migrated = stats.members.total;

                    const [g] = await conn.query(
                        `SELECT COUNT(*) as cnt FROM ${prefix}\`group\``
                    );
                    stats.boardGroups.total = (g as any)[0].cnt;
                    stats.boardGroups.migrated = stats.boardGroups.total;

                    const [b] = await conn.query(
                        `SELECT bo_table FROM ${prefix}board`
                    );
                    const boards = b as any[];
                    stats.boards.total = boards.length;
                    stats.boards.migrated = boards.length;

                    for (const board of boards) {
                        try {
                            const [p] = await conn.query(
                                `SELECT COUNT(*) as cnt FROM ${prefix}write_${board.bo_table} WHERE wr_is_comment = 0`
                            );
                            const [c] = await conn.query(
                                `SELECT COUNT(*) as cnt FROM ${prefix}write_${board.bo_table} WHERE wr_is_comment = 1`
                            );
                            stats.posts.total += (p as any)[0].cnt;
                            stats.posts.migrated += (p as any)[0].cnt;
                            stats.comments.total += (c as any)[0].cnt;
                            stats.comments.migrated += (c as any)[0].cnt;
                        } catch {
                            // 테이블 없으면 스킵
                        }
                    }

                    const [pt] = await conn.query(
                        `SELECT COUNT(*) as cnt FROM ${prefix}point`
                    );
                    stats.points.total = (pt as any)[0].cnt;
                    stats.points.migrated = stats.points.total;
                } else {
                    // 라이믹스
                    const queries: Array<[string, string, string?]> = [
                        ['members', `${prefix}member`],
                        ['boards', `${prefix}modules`, "WHERE module = 'board'"],
                        ['posts', `${prefix}documents`],
                        ['comments', `${prefix}comments`]
                    ];

                    for (const [key, table, where] of queries) {
                        try {
                            const [rows] = await conn.query(
                                `SELECT COUNT(*) as cnt FROM ${table} ${where || ''}`
                            );
                            stats[key].total = (rows as any)[0].cnt;
                            stats[key].migrated = stats[key].total;
                        } catch {
                            // 테이블 없으면 스킵
                        }
                    }
                }

                const completedAt = new Date();

                return json({
                    success: true,
                    result: {
                        success: true,
                        duration: completedAt.getTime() - startedAt.getTime(),
                        stats,
                        errors: []
                    }
                });
            } finally {
                await conn.end();
            }
        } else {
            // 실제 마이그레이션 — @angple/migration 패키지 호출
            // TODO: 프로덕션에서는 백그라운드 작업으로 실행
            return json(
                {
                    success: false,
                    error: '실제 마이그레이션은 아직 CLI를 통해서만 실행할 수 있습니다. dry-run 모드를 사용하세요.'
                },
                { status: 501 }
            );
        }
    } catch (error) {
        console.error('❌ [Migration] 실행 실패:', error);
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : '마이그레이션 실행 중 오류가 발생했습니다.'
            },
            { status: 500 }
        );
    }
};
