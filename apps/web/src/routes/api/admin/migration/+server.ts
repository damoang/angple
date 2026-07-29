/**
 * 마이그레이션 API
 *
 * POST /api/admin/migration/analyze — 사전 분석
 * POST /api/admin/migration/run — 마이그레이션 실행
 *
 * ⛔ 2026-07-29: 여기에 "인증 검증은 hooks.server.ts에서 처리" 라고 적혀 있었으나
 *    **그런 가드는 존재하지 않았다.** 훅에도, 이 핸들러에도 없었다.
 *    이 엔드포인트는 요청 본문으로 받은 임의의 host/port/user/password 로 외부 DB 에
 *    접속을 연다. 인증 없이 열려 있었다는 것은 누구나 우리 서버를 발판 삼아 임의
 *    호스트에 접속을 시도할 수 있었다는 뜻이다(내부망 포트 스캔 포함).
 *    지금은 훅 가드를 실제로 만들었고, 아래에 라우트 자체 가드도 둔다.
 *    ⛔ "훅이 막아준다"고 믿고 이 가드를 지우지 말 것.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/require-admin.js';

/**
 * POST /api/admin/migration/analyze
 * 소스 DB에 연결하여 사전 분석 수행 (관리자 전용)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    try {
        const body = await request.json();
        const { source } = body;

        // mysql2 동적 import
        const mysql = await import('mysql2/promise');
        const prefix = body.tablePrefix || (source === 'gnuboard' ? 'g5_' : 'xe_');

        const conn = await mysql.createConnection({
            host: body.host,
            port: body.port || 3306,
            user: body.user,
            password: body.password,
            database: body.database,
            connectTimeout: 10000
        });

        try {
            const tables: Array<{
                sourceTable: string;
                targetTable: string;
                rowCount: number;
                hasData: boolean;
            }> = [];
            const warnings: string[] = [];
            let totalRows = 0;

            if (source === 'gnuboard') {
                // 그누보드 분석
                const [memberRows] = await conn.query(
                    `SELECT COUNT(*) as cnt FROM ${prefix}member`
                );
                const memberCount = (memberRows as any)[0].cnt;
                tables.push({
                    sourceTable: `${prefix}member`,
                    targetTable: 'member',
                    rowCount: memberCount,
                    hasData: memberCount > 0
                });
                totalRows += memberCount;

                const [groupRows] = await conn.query(
                    `SELECT COUNT(*) as cnt FROM ${prefix}\`group\``
                );
                const groupCount = (groupRows as any)[0].cnt;
                tables.push({
                    sourceTable: `${prefix}group`,
                    targetTable: 'board_group',
                    rowCount: groupCount,
                    hasData: groupCount > 0
                });
                totalRows += groupCount;

                const [boardRows] = await conn.query(
                    `SELECT bo_table, bo_subject, bo_count_write FROM ${prefix}board`
                );
                const boards = boardRows as any[];
                tables.push({
                    sourceTable: `${prefix}board`,
                    targetTable: 'board',
                    rowCount: boards.length,
                    hasData: boards.length > 0
                });
                totalRows += boards.length;

                for (const board of boards) {
                    try {
                        const [rows] = await conn.query(
                            `SELECT COUNT(*) as cnt FROM ${prefix}write_${board.bo_table}`
                        );
                        const count = (rows as any)[0].cnt;
                        tables.push({
                            sourceTable: `${prefix}write_${board.bo_table}`,
                            targetTable: `posts+comments (${board.bo_table})`,
                            rowCount: count,
                            hasData: count > 0
                        });
                        totalRows += count;
                    } catch {
                        warnings.push(
                            `테이블 ${prefix}write_${board.bo_table}을 찾을 수 없습니다.`
                        );
                    }
                }

                const [pointRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}point`);
                const pointCount = (pointRows as any)[0].cnt;
                tables.push({
                    sourceTable: `${prefix}point`,
                    targetTable: 'point',
                    rowCount: pointCount,
                    hasData: pointCount > 0
                });
                totalRows += pointCount;
            } else {
                // 라이믹스 분석
                const tableMap: Array<[string, string]> = [
                    ['member', 'member'],
                    ['modules', 'board'],
                    ['documents', 'post'],
                    ['comments', 'comment'],
                    ['files', 'attachment']
                ];

                for (const [src, tgt] of tableMap) {
                    try {
                        let query = `SELECT COUNT(*) as cnt FROM ${prefix}${src}`;
                        if (src === 'modules') {
                            query += " WHERE module = 'board'";
                        }
                        const [rows] = await conn.query(query);
                        const count = (rows as any)[0].cnt;
                        tables.push({
                            sourceTable: `${prefix}${src}`,
                            targetTable: tgt,
                            rowCount: count,
                            hasData: count > 0
                        });
                        totalRows += count;
                    } catch {
                        warnings.push(`테이블 ${prefix}${src}을 찾을 수 없습니다.`);
                    }
                }
            }

            const estimatedSeconds = Math.max(10, Math.ceil(totalRows / 1000));
            const estimatedTime =
                estimatedSeconds < 60
                    ? `약 ${estimatedSeconds}초`
                    : `약 ${Math.ceil(estimatedSeconds / 60)}분`;

            return json({
                success: true,
                analysis: {
                    source,
                    tables,
                    totalRows,
                    estimatedTime,
                    warnings
                }
            });
        } finally {
            await conn.end();
        }
    } catch (error) {
        console.error('❌ [Migration] 분석 실패:', error);
        return json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? `DB 연결 실패: ${error.message}`
                        : 'DB 연결에 실패했습니다.'
            },
            { status: 500 }
        );
    }
};
