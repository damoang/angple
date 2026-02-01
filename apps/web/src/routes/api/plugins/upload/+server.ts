/**
 * 플러그인 업로드 API
 *
 * POST /api/plugins/upload
 * - FormData로 ZIP 파일 받기
 * - 파일 검증 (plugin.json 또는 extension.json 필수)
 * - custom-plugins/ 폴더에 압축 해제
 * - 플러그인 스캔 후 목록 갱신
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve, normalize, isAbsolute, extname } from 'path';
import AdmZip from 'adm-zip';
import { safeValidatePluginManifest } from '$lib/types/plugin';
import { sanitizePath } from '$lib/server/path-utils';
import { scanPlugins } from '$lib/server/plugins/scanner';

/** 프로젝트 루트 찾기 */
function getProjectRoot(): string {
    const cwd = process.cwd();
    if (cwd.includes('apps/web')) return resolve(cwd, '../..');
    if (cwd.includes('apps/admin')) return resolve(cwd, '../..');
    return cwd;
}

const PROJECT_ROOT = getProjectRoot();

/** 커스텀 플러그인 디렉터리 */
const CUSTOM_PLUGINS_DIR = join(PROJECT_ROOT, 'custom-plugins');

/** 최대 파일 크기: 20MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** 최대 전체 크기: 50MB */
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

/** 허용 확장자 */
const ALLOWED_EXTENSIONS = [
    '.svelte',
    '.ts',
    '.js',
    '.json',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.webp',
    '.md',
    '.yaml',
    '.yml',
    '.html',
    '.go',
    '.sql'
];

/**
 * Zip Slip 공격 방지 검증
 */
function validateZipEntries(entries: AdmZip.IZipEntry[], targetDir: string): string | null {
    let totalSize = 0;

    for (const entry of entries) {
        const normalizedPath = normalize(entry.entryName).replace(/^(\.\.(\/|\\|$))+/, '');

        // 절대 경로 체크
        if (isAbsolute(normalizedPath)) {
            return 'Zip Slip 공격 감지: 절대 경로 포함';
        }

        // 디렉터리 탐색 공격 체크
        if (normalizedPath.includes('..')) {
            return 'Zip Slip 공격 감지: 디렉터리 탈출 시도';
        }

        // Symlink 감지
        const externalAttr = entry.header.attr;
        const fileMode = (externalAttr >> 16) & 0xffff;
        const isSymlink = (fileMode & 0o170000) === 0o120000;
        if (isSymlink) {
            return 'Symlink 보안 위험 감지';
        }

        // 파일 크기 누적
        if (!entry.isDirectory) {
            totalSize += entry.header.size;

            // 개별 파일 크기 체크
            if (entry.header.size > MAX_FILE_SIZE) {
                return `파일 크기 초과: ${entry.entryName}`;
            }
        }
    }

    // 전체 크기 체크
    if (totalSize > MAX_TOTAL_SIZE) {
        return `전체 크기 초과: ${(totalSize / 1024 / 1024).toFixed(2)}MB > 50MB`;
    }

    return null;
}

/**
 * POST /api/plugins/upload
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return json({ success: false, error: '파일이 제공되지 않았습니다.' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return json(
                {
                    success: false,
                    error: `파일 크기가 너무 큽니다. (최대: ${MAX_FILE_SIZE / 1024 / 1024}MB)`
                },
                { status: 400 }
            );
        }

        const validMimeTypes = [
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream'
        ];
        if (!validMimeTypes.includes(file.type)) {
            return json(
                { success: false, error: 'ZIP 파일만 업로드 가능합니다.' },
                { status: 400 }
            );
        }

        // custom-plugins 디렉터리 생성
        if (!existsSync(CUSTOM_PLUGINS_DIR)) {
            mkdirSync(CUSTOM_PLUGINS_DIR, { recursive: true });
        }

        // 임시 ZIP 파일 저장
        const buffer = Buffer.from(await file.arrayBuffer());
        const tempZipPath = join(CUSTOM_PLUGINS_DIR, `temp-${Date.now()}.zip`);
        writeFileSync(tempZipPath, buffer);

        try {
            const zip = new AdmZip(tempZipPath);
            const zipEntries = zip.getEntries();

            // Zip Slip 보안 검증
            const securityError = validateZipEntries(zipEntries, CUSTOM_PLUGINS_DIR);
            if (securityError) {
                rmSync(tempZipPath);
                return json({ success: false, error: securityError }, { status: 400 });
            }

            // plugin.json 또는 extension.json 찾기
            let manifestEntry: AdmZip.IZipEntry | null = null;
            let manifestType: 'plugin' | 'extension' = 'plugin';
            let rootFolder = '';

            for (const entry of zipEntries) {
                const name = entry.entryName;
                if (name.endsWith('plugin.json') || name.endsWith('extension.json')) {
                    manifestEntry = entry;
                    manifestType = name.endsWith('plugin.json') ? 'plugin' : 'extension';
                    const parts = name.split('/');
                    if (parts.length > 1) {
                        rootFolder = parts[0];
                    }
                    break;
                }
            }

            if (!manifestEntry) {
                rmSync(tempZipPath);
                return json(
                    {
                        success: false,
                        error: 'ZIP 파일에 plugin.json 또는 extension.json이 없습니다.'
                    },
                    { status: 400 }
                );
            }

            // 매니페스트 검증
            const manifestContent = manifestEntry.getData().toString('utf8');
            const manifestData = JSON.parse(manifestContent);
            const validationResult = safeValidatePluginManifest(manifestData);

            if (!validationResult.success) {
                rmSync(tempZipPath);
                return json(
                    {
                        success: false,
                        error: '매니페스트 형식이 올바르지 않습니다.',
                        details: validationResult.error.issues
                    },
                    { status: 400 }
                );
            }

            const pluginManifest = validationResult.data;
            const pluginId = sanitizePath(pluginManifest.id);

            // 폴더명과 ID 일치 검증
            if (rootFolder && rootFolder !== pluginId) {
                rmSync(tempZipPath);
                return json(
                    {
                        success: false,
                        error: `ZIP 루트 폴더명(${rootFolder})과 플러그인 ID(${pluginId})가 일치하지 않습니다.`
                    },
                    { status: 400 }
                );
            }

            // 중복 설치 확인
            const targetDir = join(CUSTOM_PLUGINS_DIR, pluginId);
            if (existsSync(targetDir)) {
                rmSync(tempZipPath);
                return json(
                    {
                        success: false,
                        error: `플러그인 "${pluginId}"이(가) 이미 설치되어 있습니다.`
                    },
                    { status: 409 }
                );
            }

            // ZIP 압축 해제
            if (rootFolder) {
                const tempExtractPath = join(CUSTOM_PLUGINS_DIR, `temp-extract-${Date.now()}`);
                zip.extractAllTo(tempExtractPath, true);

                const extractedDir = join(tempExtractPath, rootFolder);
                if (existsSync(extractedDir)) {
                    const fs = await import('fs');
                    fs.renameSync(extractedDir, targetDir);
                    rmSync(tempExtractPath, { recursive: true, force: true });
                } else {
                    rmSync(tempExtractPath, { recursive: true, force: true });
                    throw new Error('압축 해제된 플러그인 폴더를 찾을 수 없습니다.');
                }
            } else {
                mkdirSync(targetDir, { recursive: true });
                zip.extractAllTo(targetDir, true);
            }

            // 임시 파일 삭제
            rmSync(tempZipPath);

            // 플러그인 재스캔
            scanPlugins();

            console.log(`[Plugin Upload] 플러그인 업로드 성공: ${pluginId}`);

            return json({
                success: true,
                message: `플러그인 "${pluginManifest.name}"이(가) 성공적으로 업로드되었습니다.`,
                pluginId,
                manifest: pluginManifest
            });
        } catch (error) {
            if (existsSync(tempZipPath)) {
                rmSync(tempZipPath);
            }

            console.error('[Plugin Upload] 업로드 처리 중 오류:', error);
            return json(
                {
                    success: false,
                    error: '플러그인 업로드 중 오류가 발생했습니다.',
                    details: error instanceof Error ? error.message : String(error)
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[Plugin Upload] 요청 처리 중 오류:', error);
        return json(
            {
                success: false,
                error: '요청 처리 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
