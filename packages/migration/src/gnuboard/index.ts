/**
 * 그누보드5 → Angple 마이그레이션 오케스트레이터
 *
 * 실행 순서:
 * 1. 소스 DB 연결 및 분석
 * 2. 게시판 그룹 마이그레이션
 * 3. 게시판 마이그레이션
 * 4. 회원 마이그레이션
 * 5. 게시글 + 댓글 마이그레이션 (게시판별)
 * 6. 포인트 마이그레이션
 * 7. 첨부파일 마이그레이션 (선택)
 * 8. 검증
 */

import type {
    MigrationOptions,
    MigrationResult,
    MigrationProgress,
    MigrationAnalysis,
    MigrationStats,
    MigrationError,
    TableAnalysis,
    DatabaseConfig
} from '../types.js';
import { createEmptyStats } from '../types.js';
import {
    mapGnuMemberToAngple,
    mapGnuBoardToAngple,
    mapGnuGroupToAngple,
    mapGnuWriteToAngplePost,
    mapGnuWriteToAngpleComment,
    mapGnuFileToAngple,
    mapGnuPointToAngple,
    parseNoticeIds,
    type GnuBoard
} from './schema-mapper.js';
import { migratePassword } from './password-compat.js';
import { migrateAttachments, convertContentImagePaths } from './attachment-migrator.js';

/** 배치 크기 */
const BATCH_SIZE = 500;

/**
 * 그누보드 사전 분석
 *
 * DB에 연결하여 테이블/레코드 수를 분석하고 예상 시간을 계산합니다.
 */
export async function analyzeGnuboard(config: DatabaseConfig): Promise<MigrationAnalysis> {
    const prefix = config.tablePrefix || 'g5_';
    const warnings: string[] = [];
    const tables: TableAnalysis[] = [];

    // mysql2 동적 import (패키지 미설치 시 graceful 처리)
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database
    });

    try {
        // 회원 수
        const [memberRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}member`);
        const memberCount = (memberRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}member`,
            targetTable: 'member',
            rowCount: memberCount,
            hasData: memberCount > 0
        });

        // 게시판 그룹
        const [groupRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}group`);
        const groupCount = (groupRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}group`,
            targetTable: 'board_group',
            rowCount: groupCount,
            hasData: groupCount > 0
        });

        // 게시판 목록
        const [boardRows] = await conn.query(
            `SELECT bo_table, bo_subject, bo_count_write, bo_count_comment FROM ${prefix}board ORDER BY bo_order`
        );
        const boards = boardRows as any[];
        tables.push({
            sourceTable: `${prefix}board`,
            targetTable: 'board',
            rowCount: boards.length,
            hasData: boards.length > 0
        });

        // 게시판별 게시글 수
        let totalPosts = 0;
        let totalComments = 0;
        for (const board of boards) {
            try {
                const writeTable = `${prefix}write_${board.bo_table}`;
                const [postRows] = await conn.query(
                    `SELECT COUNT(*) as cnt FROM ${writeTable} WHERE wr_is_comment = 0`
                );
                const [commentRows] = await conn.query(
                    `SELECT COUNT(*) as cnt FROM ${writeTable} WHERE wr_is_comment = 1`
                );
                const postCount = (postRows as any)[0].cnt;
                const commentCount = (commentRows as any)[0].cnt;
                totalPosts += postCount;
                totalComments += commentCount;

                tables.push({
                    sourceTable: writeTable,
                    targetTable: `posts (${board.bo_table})`,
                    rowCount: postCount + commentCount,
                    hasData: postCount > 0
                });
            } catch {
                warnings.push(`테이블 ${prefix}write_${board.bo_table}을 찾을 수 없습니다.`);
            }
        }

        // 포인트
        const [pointRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}point`);
        const pointCount = (pointRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}point`,
            targetTable: 'point',
            rowCount: pointCount,
            hasData: pointCount > 0
        });

        const totalRows = memberCount + groupCount + boards.length + totalPosts + totalComments + pointCount;

        // 예상 시간: 대략 1000행당 1초
        const estimatedSeconds = Math.max(10, Math.ceil(totalRows / 1000));
        const estimatedTime = estimatedSeconds < 60
            ? `약 ${estimatedSeconds}초`
            : `약 ${Math.ceil(estimatedSeconds / 60)}분`;

        // 그누보드 버전 감지
        let version: string | undefined;
        try {
            const [configRows] = await conn.query(
                `SELECT cf_title FROM ${prefix}config LIMIT 1`
            );
            if ((configRows as any[]).length > 0) {
                version = '5.x';
            }
        } catch {
            // config 테이블 없으면 무시
        }

        return {
            source: 'gnuboard',
            version,
            tables,
            totalRows,
            estimatedTime,
            warnings
        };
    } finally {
        await conn.end();
    }
}

/**
 * 그누보드 마이그레이션 실행
 */
export async function migrateGnuboard(options: MigrationOptions): Promise<MigrationResult> {
    const startedAt = new Date();
    const stats = createEmptyStats();
    const errors: MigrationError[] = [];
    const prefix = options.tablePrefix || 'g5_';

    const progress = (phase: MigrationProgress['phase'], current: number, total: number, message: string) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        options.onProgress?.({ phase, current, total, message, percent, errors });
    };

    const mysql = await import('mysql2/promise');

    // 소스 DB 연결
    progress('connecting', 0, 1, '소스 DB 연결 중...');
    const sourceConn = await mysql.createConnection({
        host: options.sourceDb.host,
        port: options.sourceDb.port,
        user: options.sourceDb.user,
        password: options.sourceDb.password,
        database: options.sourceDb.database
    });

    // 대상 DB 연결
    const targetConn = await mysql.createConnection({
        host: options.targetDb.host,
        port: options.targetDb.port,
        user: options.targetDb.user,
        password: options.targetDb.password,
        database: options.targetDb.database
    });

    try {
        // ─── 1. 게시판 그룹 ───
        progress('board_groups', 0, 1, '게시판 그룹 마이그레이션 중...');
        const [groupRows] = await sourceConn.query(`SELECT * FROM ${prefix}\`group\` ORDER BY gr_order`);
        const groups = groupRows as any[];
        stats.boardGroups.total = groups.length;

        for (const group of groups) {
            try {
                const mapped = mapGnuGroupToAngple(group);
                if (!options.dryRun) {
                    await targetConn.query(
                        `INSERT INTO board_group (gr_id, gr_subject, gr_order, gr_device) VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE gr_subject = VALUES(gr_subject), gr_order = VALUES(gr_order)`,
                        [mapped.gr_id, mapped.gr_subject, mapped.gr_order, mapped.gr_device]
                    );
                }
                stats.boardGroups.migrated++;
            } catch (err) {
                stats.boardGroups.skipped++;
                errors.push({
                    phase: 'board_groups',
                    table: `${prefix}group`,
                    message: `그룹 ${group.gr_id} 마이그레이션 실패`,
                    detail: err instanceof Error ? err.message : String(err)
                });
            }
        }

        // ─── 2. 게시판 ───
        progress('boards', 0, 1, '게시판 마이그레이션 중...');
        const [boardRows] = await sourceConn.query(`SELECT * FROM ${prefix}board ORDER BY bo_order`);
        let boards = boardRows as GnuBoard[];
        stats.boards.total = boards.length;

        // 게시판 필터 적용
        if (options.boardFilter && options.boardFilter.length > 0) {
            boards = boards.filter((b) => options.boardFilter!.includes(b.bo_table));
        }

        for (const board of boards) {
            try {
                const mapped = mapGnuBoardToAngple(board);
                if (!options.dryRun) {
                    await targetConn.query(
                        `INSERT INTO board (bo_table, bo_subject, bo_skin, gr_id, bo_list_level, bo_read_level, bo_write_level, bo_comment_level, bo_page_rows, bo_upload_count, bo_order, bo_count_write, bo_count_comment)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE bo_subject = VALUES(bo_subject)`,
                        [mapped.bo_table, mapped.bo_subject, mapped.bo_skin, mapped.gr_id, mapped.bo_list_level, mapped.bo_read_level, mapped.bo_write_level, mapped.bo_comment_level, mapped.bo_page_rows, mapped.bo_upload_count, mapped.bo_order, mapped.bo_count_write, mapped.bo_count_comment]
                    );
                }
                stats.boards.migrated++;
            } catch (err) {
                stats.boards.skipped++;
                errors.push({
                    phase: 'boards',
                    table: `${prefix}board`,
                    message: `게시판 ${board.bo_table} 마이그레이션 실패`,
                    detail: err instanceof Error ? err.message : String(err)
                });
            }
        }

        // ─── 3. 회원 ───
        const [memberCountRows] = await sourceConn.query(`SELECT COUNT(*) as cnt FROM ${prefix}member`);
        const memberTotal = (memberCountRows as any)[0].cnt;
        stats.members.total = memberTotal;

        let memberOffset = 0;
        while (memberOffset < memberTotal) {
            progress('members', memberOffset, memberTotal, `회원 마이그레이션 중... (${memberOffset}/${memberTotal})`);

            const [memberRows] = await sourceConn.query(
                `SELECT * FROM ${prefix}member ORDER BY mb_datetime LIMIT ? OFFSET ?`,
                [BATCH_SIZE, memberOffset]
            );
            const members = memberRows as any[];

            for (const member of members) {
                try {
                    const mapped = mapGnuMemberToAngple(member);
                    const pw = options.keepPhpPasswords
                        ? migratePassword(mapped.mb_password)
                        : { hash: mapped.mb_password, needsReset: false, hashType: 'raw' };

                    if (!options.dryRun) {
                        await targetConn.query(
                            `INSERT INTO member (mb_id, mb_password, mb_name, mb_nick, mb_email, mb_homepage, mb_level, mb_point, mb_ip, mb_datetime, mb_leave_date, mb_intercept_date, mb_memo)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE mb_name = VALUES(mb_name), mb_nick = VALUES(mb_nick)`,
                            [mapped.mb_id, pw.hash, mapped.mb_name, mapped.mb_nick, mapped.mb_email, mapped.mb_homepage || '', mapped.mb_level, mapped.mb_point, mapped.mb_ip || '', mapped.mb_datetime, mapped.mb_leave_date, mapped.mb_intercept_date, mapped.mb_memo]
                        );
                    }
                    stats.members.migrated++;
                } catch (err) {
                    stats.members.skipped++;
                    errors.push({
                        phase: 'members',
                        table: `${prefix}member`,
                        row: member.mb_id,
                        message: `회원 ${member.mb_id} 마이그레이션 실패`,
                        detail: err instanceof Error ? err.message : String(err)
                    });
                }
            }

            memberOffset += BATCH_SIZE;
        }

        // ─── 4. 게시글 + 댓글 ───
        for (const board of boards) {
            const writeTable = `${prefix}write_${board.bo_table}`;
            const noticeIds = parseNoticeIds(board.bo_notice);

            try {
                // 게시글 수 확인
                const [postCountRows] = await sourceConn.query(
                    `SELECT COUNT(*) as cnt FROM ${writeTable} WHERE wr_is_comment = 0`
                );
                const postTotal = (postCountRows as any)[0].cnt;
                stats.posts.total += postTotal;

                // 게시글 배치 처리
                let postOffset = 0;
                while (postOffset < postTotal) {
                    progress('posts', stats.posts.migrated, stats.posts.total,
                        `[${board.bo_table}] 게시글 마이그레이션 중... (${postOffset}/${postTotal})`);

                    const [postRows] = await sourceConn.query(
                        `SELECT * FROM ${writeTable} WHERE wr_is_comment = 0 ORDER BY wr_id LIMIT ? OFFSET ?`,
                        [BATCH_SIZE, postOffset]
                    );
                    const posts = postRows as any[];

                    for (const post of posts) {
                        try {
                            const mapped = mapGnuWriteToAngplePost(post, board.bo_table);
                            mapped.is_notice = noticeIds.includes(post.wr_id);

                            // 본문 내 이미지 경로 변환
                            if (mapped.wr_content) {
                                mapped.wr_content = convertContentImagePaths(
                                    mapped.wr_content,
                                    '', // oldBaseUrl (설정에서 가져올 수 있음)
                                    ''  // newBaseUrl (상대 경로 사용)
                                );
                            }

                            if (!options.dryRun) {
                                await targetConn.query(
                                    `INSERT INTO post (wr_id, bo_table, wr_subject, wr_content, wr_name, mb_id, wr_datetime, wr_hit, wr_good, wr_nogood, wr_comment, wr_link1, wr_link2, wr_ip, ca_name, is_secret, is_notice, extra_1, extra_2, extra_3, extra_4, extra_5, extra_6, extra_7, extra_8, extra_9, extra_10)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                     ON DUPLICATE KEY UPDATE wr_subject = VALUES(wr_subject)`,
                                    [mapped.wr_id, mapped.bo_table, mapped.wr_subject, mapped.wr_content, mapped.wr_name, mapped.mb_id, mapped.wr_datetime, mapped.wr_hit, mapped.wr_good, mapped.wr_nogood, mapped.wr_comment, mapped.wr_link1, mapped.wr_link2, mapped.wr_ip, mapped.ca_name, mapped.is_secret, mapped.is_notice, mapped.extra_1, mapped.extra_2, mapped.extra_3, mapped.extra_4, mapped.extra_5, mapped.extra_6, mapped.extra_7, mapped.extra_8, mapped.extra_9, mapped.extra_10]
                                );
                            }
                            stats.posts.migrated++;
                        } catch (err) {
                            stats.posts.skipped++;
                            errors.push({
                                phase: 'posts',
                                table: writeTable,
                                row: post.wr_id,
                                message: `게시글 ${board.bo_table}/${post.wr_id} 마이그레이션 실패`,
                                detail: err instanceof Error ? err.message : String(err)
                            });
                        }
                    }

                    postOffset += BATCH_SIZE;
                }

                // 댓글 배치 처리
                const [commentCountRows] = await sourceConn.query(
                    `SELECT COUNT(*) as cnt FROM ${writeTable} WHERE wr_is_comment = 1`
                );
                const commentTotal = (commentCountRows as any)[0].cnt;
                stats.comments.total += commentTotal;

                let commentOffset = 0;
                while (commentOffset < commentTotal) {
                    progress('comments', stats.comments.migrated, stats.comments.total,
                        `[${board.bo_table}] 댓글 마이그레이션 중...`);

                    const [commentRows] = await sourceConn.query(
                        `SELECT * FROM ${writeTable} WHERE wr_is_comment = 1 ORDER BY wr_id LIMIT ? OFFSET ?`,
                        [BATCH_SIZE, commentOffset]
                    );
                    const comments = commentRows as any[];

                    for (const comment of comments) {
                        try {
                            const mapped = mapGnuWriteToAngpleComment(comment, board.bo_table);
                            if (!options.dryRun) {
                                await targetConn.query(
                                    `INSERT INTO comment (wr_id, bo_table, wr_parent, wr_content, wr_name, mb_id, wr_datetime, wr_ip, wr_good, wr_nogood, is_secret)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                     ON DUPLICATE KEY UPDATE wr_content = VALUES(wr_content)`,
                                    [mapped.wr_id, mapped.bo_table, mapped.wr_parent, mapped.wr_content, mapped.wr_name, mapped.mb_id, mapped.wr_datetime, mapped.wr_ip, mapped.wr_good, mapped.wr_nogood, mapped.is_secret]
                                );
                            }
                            stats.comments.migrated++;
                        } catch (err) {
                            stats.comments.skipped++;
                            errors.push({
                                phase: 'comments',
                                table: writeTable,
                                row: comment.wr_id,
                                message: `댓글 ${board.bo_table}/${comment.wr_id} 마이그레이션 실패`,
                                detail: err instanceof Error ? err.message : String(err)
                            });
                        }
                    }

                    commentOffset += BATCH_SIZE;
                }
            } catch (err) {
                errors.push({
                    phase: 'posts',
                    table: writeTable,
                    message: `테이블 ${writeTable} 접근 실패`,
                    detail: err instanceof Error ? err.message : String(err)
                });
            }
        }

        // ─── 5. 포인트 ───
        progress('points', 0, 1, '포인트 마이그레이션 중...');
        const [pointCountRows] = await sourceConn.query(`SELECT COUNT(*) as cnt FROM ${prefix}point`);
        const pointTotal = (pointCountRows as any)[0].cnt;
        stats.points.total = pointTotal;

        let pointOffset = 0;
        while (pointOffset < pointTotal) {
            progress('points', pointOffset, pointTotal, `포인트 마이그레이션 중... (${pointOffset}/${pointTotal})`);

            const [pointRows] = await sourceConn.query(
                `SELECT * FROM ${prefix}point ORDER BY po_id LIMIT ? OFFSET ?`,
                [BATCH_SIZE, pointOffset]
            );
            const points = pointRows as any[];

            for (const point of points) {
                try {
                    const mapped = mapGnuPointToAngple(point);
                    if (!options.dryRun) {
                        await targetConn.query(
                            `INSERT INTO point (mb_id, point, use_point, content, datetime, rel_table, rel_id, rel_action, expired, mb_point)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [mapped.mb_id, mapped.point, mapped.use_point, mapped.content, mapped.datetime, mapped.rel_table, mapped.rel_id, mapped.rel_action, mapped.expired, mapped.mb_point]
                        );
                    }
                    stats.points.migrated++;
                } catch (err) {
                    stats.points.skipped++;
                }
            }

            pointOffset += BATCH_SIZE;
        }

        // ─── 6. 첨부파일 ───
        if (options.migrateAttachments && options.attachmentSourcePath && options.attachmentTargetPath) {
            progress('attachments', 0, 1, '첨부파일 마이그레이션 중...');
            const boardTables = boards.map((b) => b.bo_table);
            const attachResult = await migrateAttachments(
                options.attachmentSourcePath,
                options.attachmentTargetPath,
                boardTables
            );
            stats.attachments.total = attachResult.total;
            stats.attachments.migrated = attachResult.migrated;
            stats.attachments.skipped = attachResult.skipped;

            for (const err of attachResult.errors) {
                errors.push({
                    phase: 'attachments',
                    message: `첨부파일 ${err.file} 복사 실패`,
                    detail: err.error
                });
            }
        }

        // ─── 7. 검증 ───
        progress('verifying', 0, 1, '마이그레이션 결과 검증 중...');

        progress('done', 1, 1, '마이그레이션 완료!');

        const completedAt = new Date();
        return {
            success: errors.length === 0,
            source: 'gnuboard',
            startedAt,
            completedAt,
            duration: completedAt.getTime() - startedAt.getTime(),
            stats,
            errors
        };
    } finally {
        await sourceConn.end();
        await targetConn.end();
    }
}
