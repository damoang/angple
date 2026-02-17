/**
 * 테마 설치 API (Zip 파일 업로드)
 *
 * POST /api/themes/install
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import AdmZip, { type IZipEntry } from 'adm-zip';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ThemeManifestSchema } from '$lib/types/theme';
import {
    validateThemeFiles,
    validateFileSizes,
    hasThemeManifest,
    type FileInfo
} from '$lib/server/theme-security';
import { safeBasename } from '$lib/server/path-utils';

// 테마 디렉터리 경로
const THEMES_DIR = path.join(process.cwd(), 'themes');
const TEMP_DIR = path.join(process.cwd(), '.tmp');

/**
 * Zip 파일에서 테마 설치
 */
export const POST: RequestHandler = async ({ request }) => {
    let tempExtractPath: string | null = null;

    try {
        // 1. FormData에서 zip 파일 가져오기
        const formData = await request.formData();
        const file = formData.get('theme') as File;

        if (!file) {
            return json({ error: 'Zip 파일이 제공되지 않았습니다.' }, { status: 400 });
        }

        // 2. 파일 타입 검증
        if (!file.name.endsWith('.zip')) {
            return json({ error: 'Zip 파일만 업로드 가능합니다.' }, { status: 400 });
        }

        // 3. 파일 크기 검증 (100MB 제한)
        if (file.size > 100 * 1024 * 1024) {
            return json({ error: '파일 크기가 100MB를 초과합니다.' }, { status: 400 });
        }

        // 4. 임시 디렉터리 생성
        if (!existsSync(TEMP_DIR)) {
            await mkdir(TEMP_DIR, { recursive: true });
        }

        const tempId = `theme-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const tempZipPath = path.join(TEMP_DIR, `${tempId}.zip`);
        tempExtractPath = path.join(TEMP_DIR, tempId);

        // 5. Zip 파일을 임시 경로에 저장
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(tempZipPath, buffer);

        // 6. Zip 압축 해제
        const zip = new AdmZip(tempZipPath);
        const zipEntries = zip.getEntries();

        // 7. theme.json 존재 여부 확인
        const fileList = zipEntries.map((entry: IZipEntry) => entry.entryName);
        if (!hasThemeManifest(fileList)) {
            return json(
                {
                    error: 'theme.json 파일이 포함되지 않았습니다. 올바른 테마 패키지인지 확인하세요.'
                },
                { status: 400 }
            );
        }

        // 8. Zip Slip 방어: 압축 해제 전 경로 검증 및 파일 크기 검증
        await mkdir(tempExtractPath, { recursive: true });

        const fileInfos: FileInfo[] = [];
        const validatedEntries: IZipEntry[] = [];

        for (const entry of zipEntries) {
            if (entry.isDirectory) {
                continue;
            }

            // 8-1. Zip Slip 방어: 경로 정규화 및 검증
            const normalizedPath = path.normalize(entry.entryName).replace(/^(\.\.(\/|\\|$))+/, '');
            const targetPath = path.join(tempExtractPath, normalizedPath);

            // 절대 경로 체크
            if (path.isAbsolute(normalizedPath)) {
                return json(
                    {
                        error: 'Zip Slip 공격 감지: 절대 경로 포함',
                        file: entry.entryName
                    },
                    { status: 400 }
                );
            }

            // 디렉터리 탐색 공격 체크
            if (normalizedPath.includes('..') || !targetPath.startsWith(tempExtractPath)) {
                return json(
                    {
                        error: 'Zip Slip 공격 감지: 디렉터리 탈출 시도',
                        file: entry.entryName
                    },
                    { status: 400 }
                );
            }

            // 8-2. Symlink 검증 (압축 해제 전 - Zip entry 메타데이터 검사)
            // Unix 파일 속성: 상위 16비트에 파일 모드 저장
            // Symlink: (mode & 0o170000) === 0o120000
            const externalAttr = entry.header.attr;
            const fileMode = (externalAttr >> 16) & 0xffff;
            const isSymlink = (fileMode & 0o170000) === 0o120000;

            if (isSymlink) {
                console.error(`[Theme Install] Symlink 감지 (압축 해제 전): ${entry.entryName}`);
                return json(
                    {
                        error: 'Symlink 보안 위험 감지',
                        file: entry.entryName
                    },
                    { status: 400 }
                );
            }

            // 8-3. 파일 크기 사전 검증 (해제 전)
            fileInfos.push({
                path: entry.entryName,
                size: entry.header.size // Zip entry의 압축 해제 후 크기
            });

            validatedEntries.push(entry);
        }

        // 8-4. 파일 크기 제한 검증
        const sizeValidation = validateFileSizes(fileInfos);
        if (!sizeValidation.valid) {
            return json(
                {
                    error: '파일 크기 제한 초과',
                    details: sizeValidation.errors
                },
                { status: 400 }
            );
        }

        // 8-5. 검증된 파일만 안전하게 추출
        for (const entry of validatedEntries) {
            const normalizedPath = path.normalize(entry.entryName).replace(/^(\.\.(\/|\\|$))+/, '');
            zip.extractEntryTo(entry, tempExtractPath, true, true, true, normalizedPath);
        }

        // 9. 보안 검증
        const securityValidation = await validateThemeFiles(
            fileList.filter((f: string) => !f.endsWith('/')),
            tempExtractPath
        );

        if (!securityValidation.valid) {
            console.error('[Theme Install] 보안 검증 실패:', securityValidation.errors);
            return json(
                {
                    error: '보안 검증 실패',
                    details: securityValidation.errors
                },
                { status: 400 }
            );
        }

        // 10. theme.json 읽기 및 검증
        const manifestPath = fileList.find(
            (f: string) => f === 'theme.json' || f.endsWith('/theme.json')
        );
        if (!manifestPath) {
            return json({ error: 'theme.json을 찾을 수 없습니다.' }, { status: 400 });
        }

        const manifestFullPath = path.join(tempExtractPath, manifestPath);
        const manifestContent = await readFile(manifestFullPath, 'utf-8');
        const manifestJson = JSON.parse(manifestContent);

        // Zod 스키마로 검증
        const validationResult = ThemeManifestSchema.safeParse(manifestJson);
        if (!validationResult.success) {
            return json(
                {
                    error: 'theme.json 검증 실패',
                    details: validationResult.error.issues.map(
                        (e) => `${e.path.join('.')}: ${e.message}`
                    )
                },
                { status: 400 }
            );
        }

        const manifest = validationResult.data;

        // 11. 테마가 이미 설치되어 있는지 확인
        const targetPath = path.join(THEMES_DIR, manifest.id);
        if (existsSync(targetPath)) {
            return json(
                {
                    error: '이미 설치된 테마입니다.',
                    themeId: manifest.id
                },
                { status: 409 }
            );
        }

        // 12. themes/ 폴더에 복사
        await mkdir(THEMES_DIR, { recursive: true });

        // 압축 해제된 폴더를 테마 디렉터리로 복사
        // (압축 파일이 루트에 바로 파일들이 있거나, 하위 폴더를 가질 수 있음)
        const extractedFiles = await import('fs').then((fs) =>
            fs.promises.readdir(tempExtractPath as string, { withFileTypes: true })
        );

        // 단일 폴더만 있는 경우 (예: theme-name/theme.json) 해당 폴더를 사용
        if (extractedFiles.length === 1 && extractedFiles[0].isDirectory()) {
            const singleFolder = path.join(tempExtractPath as string, extractedFiles[0].name);
            await copyDir(singleFolder, targetPath);
        } else {
            // 루트에 바로 파일들이 있는 경우
            await copyDir(tempExtractPath as string, targetPath);
        }

        // 13. 임시 파일 삭제
        await rm(tempZipPath, { force: true });
        await rm(tempExtractPath, { recursive: true, force: true });

        return json({
            success: true,
            message: '테마가 성공적으로 설치되었습니다.',
            theme: {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version
            }
        });
    } catch (error) {
        console.error('[Theme Install] 설치 실패:', error);

        // 에러 발생 시 임시 파일 정리
        if (tempExtractPath && existsSync(tempExtractPath)) {
            await rm(tempExtractPath, { recursive: true, force: true }).catch(() => {});
        }

        return json(
            {
                error: '테마 설치 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};

/**
 * 디렉터리 복사 헬퍼 함수
 */
async function copyDir(src: string, dest: string) {
    await mkdir(dest, { recursive: true });

    const entries = await import('fs').then((fs) =>
        fs.promises.readdir(src, { withFileTypes: true })
    );

    for (const entry of entries) {
        const safeName = safeBasename(entry.name);
        // safeName은 safeBasename()으로 검증됨
        const srcPath = path.join(src, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const destPath = path.join(dest, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await import('fs').then((fs) => fs.promises.copyFile(srcPath, destPath));
        }
    }
}
