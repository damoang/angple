/**
 * GitHub 테마 설치 API
 *
 * POST /api/themes/install-github
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import simpleGit from 'simple-git';
import { mkdir, rm, readFile } from 'fs/promises';
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
 * GitHub URL 검증
 */
function isValidGitHubUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return (
            (parsedUrl.hostname === 'github.com' || parsedUrl.hostname === 'www.github.com') &&
            parsedUrl.pathname.split('/').filter(Boolean).length >= 2
        );
    } catch {
        return false;
    }
}

/**
 * 디렉터리의 모든 파일 목록 가져오기 (재귀)
 */
async function getFileList(dir: string, baseDir: string = dir): Promise<string[]> {
    const { readdir } = await import('fs/promises');
    const files: string[] = [];

    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const safeName = safeBasename(entry.name);
        // safeName은 safeBasename()으로 검증됨
        const fullPath = path.join(dir, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            // .git 폴더는 스킵
            if (entry.name === '.git') continue;

            const subFiles = await getFileList(fullPath, baseDir);
            files.push(...subFiles);
        } else {
            files.push(relativePath);
        }
    }

    return files;
}

/**
 * 디렉터리 복사 (재귀)
 */
async function copyDir(src: string, dest: string) {
    const { readdir, copyFile } = await import('fs/promises');

    await mkdir(dest, { recursive: true });

    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const safeName = safeBasename(entry.name);
        // safeName은 safeBasename()으로 검증됨
        const srcPath = path.join(src, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
        const destPath = path.join(dest, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal

        if (entry.isDirectory()) {
            // .git 폴더는 복사하지 않음
            if (entry.name === '.git') continue;
            await copyDir(srcPath, destPath);
        } else {
            await copyFile(srcPath, destPath);
        }
    }
}

/**
 * GitHub URL에서 테마 설치
 */
export const POST: RequestHandler = async ({ request }) => {
    let tempClonePath: string | null = null;

    try {
        // 1. 요청 본문에서 GitHub URL 가져오기
        const body = await request.json();
        const { githubUrl } = body;

        if (!githubUrl) {
            return json({ error: 'GitHub URL이 제공되지 않았습니다.' }, { status: 400 });
        }

        // 2. GitHub URL 검증
        if (!isValidGitHubUrl(githubUrl)) {
            return json(
                {
                    error: '유효하지 않은 GitHub URL입니다.',
                    message: 'https://github.com/user/repo 형식이어야 합니다.'
                },
                { status: 400 }
            );
        }

        console.log(`📦 [GitHub Install] GitHub URL 수신: ${githubUrl}`);

        // 3. 임시 디렉터리 생성
        if (!existsSync(TEMP_DIR)) {
            await mkdir(TEMP_DIR, { recursive: true });
        }

        const tempId = `github-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        tempClonePath = path.join(TEMP_DIR, tempId);

        // 4. Git clone 실행
        console.log(`🔄 [GitHub Install] Cloning repository...`);
        const git = simpleGit();

        try {
            await git.clone(githubUrl, tempClonePath, ['--depth', '1']);
        } catch (gitError) {
            console.error('❌ [GitHub Install] Git clone 실패:', gitError);
            return json(
                {
                    error: 'GitHub 저장소를 클론할 수 없습니다.',
                    details: gitError instanceof Error ? gitError.message : String(gitError),
                    message: '저장소가 존재하는지, 공개 저장소인지 확인해주세요.'
                },
                { status: 400 }
            );
        }

        console.log(`✅ [GitHub Install] Clone 완료: ${tempClonePath}`);

        // 5. 파일 목록 가져오기
        const fileList = await getFileList(tempClonePath);

        // 6. theme.json 존재 여부 확인
        if (!hasThemeManifest(fileList)) {
            return json(
                {
                    error: 'theme.json 파일이 포함되지 않았습니다.',
                    message: '올바른 테마 저장소인지 확인하세요.'
                },
                { status: 400 }
            );
        }

        // 7. 파일 크기 검증
        const fileInfos: FileInfo[] = [];
        for (const file of fileList) {
            const filePath = path.join(tempClonePath, file);
            const { stat } = await import('fs/promises');
            const stats = await stat(filePath);
            fileInfos.push({
                path: file,
                size: stats.size
            });
        }

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

        // 8. 보안 검증
        const securityValidation = await validateThemeFiles(fileList, tempClonePath);

        if (!securityValidation.valid) {
            console.error('🚨 [GitHub Install] 보안 검증 실패:', securityValidation.errors);
            return json(
                {
                    error: '보안 검증 실패',
                    details: securityValidation.errors
                },
                { status: 400 }
            );
        }

        // 9. theme.json 읽기 및 검증
        const manifestPath = fileList.find(
            (f: string) => f === 'theme.json' || f.endsWith('/theme.json')
        );

        if (!manifestPath) {
            return json({ error: 'theme.json을 찾을 수 없습니다.' }, { status: 400 });
        }

        const manifestFullPath = path.join(tempClonePath, manifestPath);
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
        console.log(`✅ [GitHub Install] Manifest 검증 완료: ${manifest.id}`);

        // 10. 테마가 이미 설치되어 있는지 확인
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

        // 11. themes/ 폴더에 복사 (.git 제외)
        await mkdir(THEMES_DIR, { recursive: true });

        console.log(`📂 [GitHub Install] Copying to themes/${manifest.id}...`);
        await copyDir(tempClonePath, targetPath);

        console.log(`✅ [GitHub Install] 테마 설치 완료: ${manifest.id}`);

        // 12. 임시 파일 삭제
        await rm(tempClonePath, { recursive: true, force: true });

        return json({
            success: true,
            message: 'GitHub 테마가 성공적으로 설치되었습니다.',
            theme: {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version
            }
        });
    } catch (error) {
        console.error('❌ [GitHub Install] 설치 실패:', error);

        // 에러 발생 시 임시 파일 정리
        if (tempClonePath && existsSync(tempClonePath)) {
            await rm(tempClonePath, { recursive: true, force: true }).catch(() => {});
        }

        return json(
            {
                error: 'GitHub 테마 설치 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
