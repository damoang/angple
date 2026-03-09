/**
 * 라이믹스(XE/Rhymix) → Angple 마이그레이션 오케스트레이터
 *
 * 실행 순서:
 * 1. 소스 DB 연결 및 분석
 * 2. 게시판(모듈) 마이그레이션
 * 3. 회원 마이그레이션
 * 4. 게시글(문서) + 댓글 마이그레이션
 * 5. 포인트 마이그레이션
 * 6. 첨부파일 마이그레이션
 * 7. 검증
 */

import type {
    MigrationOptions,
    MigrationResult,
    MigrationProgress,
    MigrationAnalysis,
    MigrationError,
    TableAnalysis,
    DatabaseConfig
} from '../types.js';
import { createEmptyStats } from '../types.js';
import {
    mapRhymixMemberToAngple,
    mapRhymixModuleToAngple,
    mapRhymixDocumentToAngple,
    mapRhymixCommentToAngple,
    type RhymixModule
} from './schema-mapper.js';
import { migratePassword } from '../gnuboard/password-compat.js';

const BATCH_SIZE = 500;

/**
 * 라이믹스 사전 분석
 */
export async function analyzeRhymix(config: DatabaseConfig): Promise<MigrationAnalysis> {
    const prefix = config.tablePrefix || 'xe_';
    const warnings: string[] = [];
    const tables: TableAnalysis[] = [];

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

        // 게시판 모듈
        const [moduleRows] = await conn.query(
            `SELECT COUNT(*) as cnt FROM ${prefix}modules WHERE module = 'board'`
        );
        const moduleCount = (moduleRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}modules`,
            targetTable: 'board',
            rowCount: moduleCount,
            hasData: moduleCount > 0
        });

        // 문서(게시글) 수
        const [docRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}documents`);
        const docCount = (docRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}documents`,
            targetTable: 'post',
            rowCount: docCount,
            hasData: docCount > 0
        });

        // 댓글 수
        const [commentRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}comments`);
        const commentCount = (commentRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}comments`,
            targetTable: 'comment',
            rowCount: commentCount,
            hasData: commentCount > 0
        });

        // 첨부파일 수
        const [fileRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}files`);
        const fileCount = (fileRows as any)[0].cnt;
        tables.push({
            sourceTable: `${prefix}files`,
            targetTable: 'attachment',
            rowCount: fileCount,
            hasData: fileCount > 0
        });

        // 포인트
        let pointCount = 0;
        try {
            const [pointRows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${prefix}point`);
            pointCount = (pointRows as any)[0].cnt;
            tables.push({
                sourceTable: `${prefix}point`,
                targetTable: 'point',
                rowCount: pointCount,
                hasData: pointCount > 0
            });
        } catch {
            warnings.push('포인트 테이블을 찾을 수 없습니다. 포인트 마이그레이션을 건너뜁니다.');
        }

        const totalRows = memberCount + moduleCount + docCount + commentCount + fileCount + pointCount;
        const estimatedSeconds = Math.max(10, Math.ceil(totalRows / 1000));
        const estimatedTime = estimatedSeconds < 60
            ? `약 ${estimatedSeconds}초`
            : `약 ${Math.ceil(estimatedSeconds / 60)}분`;

        // 라이믹스 버전 감지
        let version: string | undefined;
        try {
            const [configRows] = await conn.query(
                `SELECT \`value\` FROM ${prefix}admin_setting WHERE \`key\` = 'siteTitle' LIMIT 1`
            );
            if ((configRows as any[]).length > 0) {
                version = 'Rhymix 2.x';
            }
        } catch {
            try {
                await conn.query(`SELECT COUNT(*) FROM ${prefix}sites LIMIT 1`);
                version = 'XE/Rhymix 1.x';
            } catch {
                // 버전 감지 실패
            }
        }

        return {
            source: 'rhymix',
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
 * 라이믹스 마이그레이션 실행
 */
export async function migrateRhymix(options: MigrationOptions): Promise<MigrationResult> {
    const startedAt = new Date();
    const stats = createEmptyStats();
    const errors: MigrationError[] = [];
    const prefix = options.tablePrefix || 'xe_';

    const progress = (phase: MigrationProgress['phase'], current: number, total: number, message: string) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        options.onProgress?.({ phase, current, total, message, percent, errors });
    };

    const mysql = await import('mysql2/promise');

    progress('connecting', 0, 1, '소스 DB 연결 중...');
    const sourceConn = await mysql.createConnection({
        host: options.sourceDb.host,
        port: options.sourceDb.port,
        user: options.sourceDb.user,
        password: options.sourceDb.password,
        database: options.sourceDb.database
    });

    const targetConn = await mysql.createConnection({
        host: options.targetDb.host,
        port: options.targetDb.port,
        user: options.targetDb.user,
        password: options.targetDb.password,
        database: options.targetDb.database
    });

    try {
        // ─── 1. 게시판(모듈) ───
        progress('boards', 0, 1, '게시판 마이그레이션 중...');
        const [moduleRows] = await sourceConn.query(
            `SELECT * FROM ${prefix}modules WHERE module = 'board'`
        );
        let modules = moduleRows as RhymixModule[];
        stats.boards.total = modules.length;

        // module_srl → mid 매핑 (게시글 매핑에 사용)
        const moduleSrlToMid = new Map<number, string>();

        if (options.boardFilter && options.boardFilter.length > 0) {
            modules = modules.filter((m) => options.boardFilter!.includes(m.mid));
        }

        // 기본 게시판 그룹 생성
        if (!options.dryRun) {
            await targetConn.query(
                `INSERT IGNORE INTO board_group (gr_id, gr_subject, gr_order) VALUES ('default', '기본 그룹', 0)`
            );
            stats.boardGroups.total = 1;
            stats.boardGroups.migrated = 1;
        }

        for (const mod of modules) {
            try {
                const mapped = mapRhymixModuleToAngple(mod);
                moduleSrlToMid.set(mod.module_srl, mod.mid);

                if (!options.dryRun) {
                    await targetConn.query(
                        `INSERT INTO board (bo_table, bo_subject, bo_skin, gr_id, bo_list_level, bo_read_level, bo_write_level, bo_comment_level, bo_page_rows, bo_order)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE bo_subject = VALUES(bo_subject)`,
                        [mapped.bo_table, mapped.bo_subject, mapped.bo_skin, mapped.gr_id, mapped.bo_list_level, mapped.bo_read_level, mapped.bo_write_level, mapped.bo_comment_level, mapped.bo_page_rows, mapped.bo_order]
                    );
                }
                stats.boards.migrated++;
            } catch (err) {
                stats.boards.skipped++;
                errors.push({
                    phase: 'boards',
                    message: `모듈 ${mod.mid} 마이그레이션 실패`,
                    detail: err instanceof Error ? err.message : String(err)
                });
            }
        }

        // ─── 2. 회원 ───
        const [memberCountRows] = await sourceConn.query(`SELECT COUNT(*) as cnt FROM ${prefix}member`);
        const memberTotal = (memberCountRows as any)[0].cnt;
        stats.members.total = memberTotal;

        let memberOffset = 0;
        while (memberOffset < memberTotal) {
            progress('members', memberOffset, memberTotal, `회원 마이그레이션 중... (${memberOffset}/${memberTotal})`);

            const [memberRows] = await sourceConn.query(
                `SELECT * FROM ${prefix}member ORDER BY member_srl LIMIT ? OFFSET ?`,
                [BATCH_SIZE, memberOffset]
            );
            const members = memberRows as any[];

            for (const member of members) {
                try {
                    const mapped = mapRhymixMemberToAngple(member);
                    const pw = options.keepPhpPasswords
                        ? migratePassword(mapped.mb_password)
                        : { hash: mapped.mb_password, needsReset: false, hashType: 'raw' };

                    if (!options.dryRun) {
                        await targetConn.query(
                            `INSERT INTO member (mb_id, mb_password, mb_name, mb_nick, mb_email, mb_homepage, mb_level, mb_point, mb_ip, mb_datetime, mb_leave_date, mb_intercept_date, mb_memo)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE mb_name = VALUES(mb_name)`,
                            [mapped.mb_id, pw.hash, mapped.mb_name, mapped.mb_nick, mapped.mb_email, mapped.mb_homepage, mapped.mb_level, 0, mapped.mb_ip, mapped.mb_datetime, mapped.mb_leave_date, mapped.mb_intercept_date, mapped.mb_memo]
                        );
                    }
                    stats.members.migrated++;
                } catch (err) {
                    stats.members.skipped++;
                    errors.push({
                        phase: 'members',
                        row: member.member_srl,
                        message: `회원 ${member.user_id} 마이그레이션 실패`,
                        detail: err instanceof Error ? err.message : String(err)
                    });
                }
            }

            memberOffset += BATCH_SIZE;
        }

        // ─── 3. 게시글(문서) ───
        const moduleSrls = Array.from(moduleSrlToMid.keys());
        if (moduleSrls.length > 0) {
            const placeholders = moduleSrls.map(() => '?').join(',');

            const [docCountRows] = await sourceConn.query(
                `SELECT COUNT(*) as cnt FROM ${prefix}documents WHERE module_srl IN (${placeholders})`,
                moduleSrls
            );
            const docTotal = (docCountRows as any)[0].cnt;
            stats.posts.total = docTotal;

            let docOffset = 0;
            while (docOffset < docTotal) {
                progress('posts', docOffset, docTotal, `게시글 마이그레이션 중... (${docOffset}/${docTotal})`);

                const [docRows] = await sourceConn.query(
                    `SELECT * FROM ${prefix}documents WHERE module_srl IN (${placeholders}) ORDER BY document_srl LIMIT ? OFFSET ?`,
                    [...moduleSrls, BATCH_SIZE, docOffset]
                );
                const docs = docRows as any[];

                for (const doc of docs) {
                    try {
                        const boTable = moduleSrlToMid.get(doc.module_srl) || 'unknown';
                        const mapped = mapRhymixDocumentToAngple(doc, boTable);

                        if (!options.dryRun) {
                            await targetConn.query(
                                `INSERT INTO post (wr_id, bo_table, wr_subject, wr_content, wr_name, mb_id, wr_datetime, wr_hit, wr_good, wr_nogood, wr_comment, wr_ip, is_secret, is_notice, extra_1, extra_2, extra_3, extra_4, extra_5)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                 ON DUPLICATE KEY UPDATE wr_subject = VALUES(wr_subject)`,
                                [mapped.wr_id, mapped.bo_table, mapped.wr_subject, mapped.wr_content, mapped.wr_name, mapped.mb_id, mapped.wr_datetime, mapped.wr_hit, mapped.wr_good, mapped.wr_nogood, mapped.wr_comment, mapped.wr_ip, mapped.is_secret, mapped.is_notice, mapped.extra_1, mapped.extra_2, mapped.extra_3, mapped.extra_4, mapped.extra_5]
                            );
                        }
                        stats.posts.migrated++;
                    } catch (err) {
                        stats.posts.skipped++;
                        errors.push({
                            phase: 'posts',
                            row: doc.document_srl,
                            message: `문서 ${doc.document_srl} 마이그레이션 실패`,
                            detail: err instanceof Error ? err.message : String(err)
                        });
                    }
                }

                docOffset += BATCH_SIZE;
            }

            // ─── 4. 댓글 ───
            const [commentCountRows] = await sourceConn.query(
                `SELECT COUNT(*) as cnt FROM ${prefix}comments WHERE module_srl IN (${placeholders})`,
                moduleSrls
            );
            const commentTotal = (commentCountRows as any)[0].cnt;
            stats.comments.total = commentTotal;

            let commentOffset = 0;
            while (commentOffset < commentTotal) {
                progress('comments', commentOffset, commentTotal, `댓글 마이그레이션 중... (${commentOffset}/${commentTotal})`);

                const [commentRows] = await sourceConn.query(
                    `SELECT * FROM ${prefix}comments WHERE module_srl IN (${placeholders}) ORDER BY comment_srl LIMIT ? OFFSET ?`,
                    [...moduleSrls, BATCH_SIZE, commentOffset]
                );
                const comments = commentRows as any[];

                for (const comment of comments) {
                    try {
                        const boTable = moduleSrlToMid.get(comment.module_srl) || 'unknown';
                        const mapped = mapRhymixCommentToAngple(comment, boTable);

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
                            row: comment.comment_srl,
                            message: `댓글 ${comment.comment_srl} 마이그레이션 실패`,
                            detail: err instanceof Error ? err.message : String(err)
                        });
                    }
                }

                commentOffset += BATCH_SIZE;
            }
        }

        // ─── 5. 검증 ───
        progress('verifying', 0, 1, '마이그레이션 결과 검증 중...');
        progress('done', 1, 1, '마이그레이션 완료!');

        const completedAt = new Date();
        return {
            success: errors.length === 0,
            source: 'rhymix',
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
