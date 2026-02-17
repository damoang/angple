/**
 * 그누보드 첨부파일 마이그레이터
 *
 * 그누보드 첨부파일 구조:
 * g5_data/file/{bo_table}/{저장파일명}
 *
 * Angple 첨부파일 구조:
 * uploads/{bo_table}/{저장파일명} 또는 S3 업로드
 */

import fs from 'node:fs';
import path from 'node:path';

/** 첨부파일 마이그레이션 결과 */
export interface AttachmentMigrationResult {
    total: number;
    migrated: number;
    skipped: number;
    errors: Array<{ file: string; error: string }>;
}

/**
 * 첨부파일 복사
 *
 * 그누보드 g5_data/file/ → Angple uploads/
 */
export async function migrateAttachments(
    sourcePath: string,
    targetPath: string,
    boards: string[]
): Promise<AttachmentMigrationResult> {
    const result: AttachmentMigrationResult = {
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: []
    };

    for (const boTable of boards) {
        const sourceDir = path.join(sourcePath, boTable);
        const targetDir = path.join(targetPath, boTable);

        if (!fs.existsSync(sourceDir)) {
            continue;
        }

        // 대상 디렉토리 생성
        fs.mkdirSync(targetDir, { recursive: true });

        const files = fs.readdirSync(sourceDir);
        result.total += files.length;

        for (const file of files) {
            const srcFile = path.join(sourceDir, file);
            const dstFile = path.join(targetDir, file);

            try {
                // 파일인지 확인 (디렉토리 스킵)
                const stat = fs.statSync(srcFile);
                if (!stat.isFile()) {
                    result.skipped++;
                    continue;
                }

                // 이미 존재하면 스킵
                if (fs.existsSync(dstFile)) {
                    result.skipped++;
                    continue;
                }

                fs.copyFileSync(srcFile, dstFile);
                result.migrated++;
            } catch (err) {
                result.errors.push({
                    file: `${boTable}/${file}`,
                    error: err instanceof Error ? err.message : String(err)
                });
            }
        }
    }

    return result;
}

/**
 * 그누보드 첨부파일 경로 변환
 *
 * 원본: data/file/{bo_table}/{bf_file}
 * 변환: /uploads/{bo_table}/{bf_file}
 */
export function convertAttachmentUrl(
    originalPath: string,
    boTable: string,
    fileName: string
): string {
    return `/uploads/${boTable}/${fileName}`;
}

/**
 * 게시글 본문 내 이미지 경로 변환
 *
 * 그누보드 본문에는 다양한 형태의 이미지 경로가 포함될 수 있음:
 * - /data/file/{bo_table}/{파일명}
 * - data/file/{bo_table}/{파일명}
 * - {도메인}/data/file/{bo_table}/{파일명}
 */
export function convertContentImagePaths(
    content: string,
    oldBaseUrl: string,
    newBaseUrl: string
): string {
    if (!content) return content;

    // /data/file/ 경로 변환
    let result = content.replace(
        /(?:https?:\/\/[^/]*)?\/data\/file\//g,
        `${newBaseUrl}/uploads/`
    );

    // data/file/ 상대 경로 변환
    result = result.replace(
        /(?<!=["'])data\/file\//g,
        `${newBaseUrl}/uploads/`
    );

    // 커스텀 도메인 변환 (oldBaseUrl이 제공된 경우)
    if (oldBaseUrl) {
        const escapedUrl = oldBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(
            new RegExp(escapedUrl + '/data/file/', 'g'),
            `${newBaseUrl}/uploads/`
        );
    }

    return result;
}
