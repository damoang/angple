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
import { getTokenProvider } from '$lib/server/github-tokens/token-provider';

// 테마 디렉터리 경로
const THEMES_DIR = path.join(process.cwd(), 'themes');
const CUSTOM_THEMES_DIR = path.join(process.cwd(), 'custom-themes');
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
    const { readdir, lstat } = await import('fs/promises');
    const files: string[] = [];

    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const safeName = safeBasename(entry.name);
        // safeName은 safeBasename()으로 검증됨
        const fullPath = path.join(dir, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const relativePath = path.relative(baseDir, fullPath);

        // Symlink 보안 체크
        const stats = await lstat(fullPath);
        if (stats.isSymbolicLink()) {
            continue;
        }

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
    const { readdir, copyFile, lstat } = await import('fs/promises');

    await mkdir(dest, { recursive: true });

    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const safeName = safeBasename(entry.name);
        // safeName은 safeBasename()으로 검증됨
        const srcPath = path.join(src, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const destPath = path.join(dest, safeName); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

        // Symlink 보안 체크
        const stats = await lstat(srcPath);
        if (stats.isSymbolicLink()) {
            continue;
        }

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
        // 1. 요청 본문에서 파라미터 가져오기
        const body = await request.json();
        const { githubUrl, scope, subdirectory } = body;

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

        // 3. 임시 디렉터리 생성
        if (!existsSync(TEMP_DIR)) {
            await mkdir(TEMP_DIR, { recursive: true });
        }

        const tempId = `github-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        tempClonePath = path.join(TEMP_DIR, tempId);

        // 4. Git clone 실행 (scope가 있으면 인증된 clone)
        const git = simpleGit();
        let cloneUrl = githubUrl;

        if (scope) {
            const tokenProvider = getTokenProvider();
            const token = await tokenProvider.getToken(scope);
            if (token) {
                const parsedUrl = new URL(githubUrl);
                parsedUrl.username = 'x-access-token';
                parsedUrl.password = token;
                cloneUrl = parsedUrl.toString();
            } else {
                return json(
                    {
                        error: 'GitHub 토큰이 설정되지 않았습니다.',
                        message: `'${scope}' scope의 토큰을 먼저 등록해주세요.`,
                        requiresAuth: true
                    },
                    { status: 401 }
                );
            }
        }

        try {
            await git.clone(cloneUrl, tempClonePath, ['--depth', '1']);
        } catch (gitError) {
            console.error('[GitHub Install] Git clone 실패:', gitError);
            return json(
                {
                    error: 'GitHub 저장소를 클론할 수 없습니다.',
                    details: gitError instanceof Error ? gitError.message : String(gitError),
                    message: scope
                        ? '토큰 권한을 확인하거나, 저장소가 존재하는지 확인해주세요.'
                        : '저장소가 존재하는지, 공개 저장소인지 확인해주세요.'
                },
                { status: 400 }
            );
        }

        // 4.5. subdirectory 처리 — 모노레포에서 특정 테마만 추출
        let themeSourcePath = tempClonePath;
        if (subdirectory) {
            const subPath = path.join(tempClonePath, subdirectory);
            if (!existsSync(subPath)) {
                return json(
                    {
                        error: `서브디렉토리 '${subdirectory}'를 찾을 수 없습니다.`,
                        message: '저장소 구조를 확인해주세요.'
                    },
                    { status: 400 }
                );
            }
            themeSourcePath = subPath;
        }

        // 5. 파일 목록 가져오기
        const fileList = await getFileList(themeSourcePath);

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
            const filePath = path.join(themeSourcePath, file);
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
        const securityValidation = await validateThemeFiles(fileList, themeSourcePath);

        if (!securityValidation.valid) {
            console.error('[GitHub Install] 보안 검증 실패:', securityValidation.errors);
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

        const manifestFullPath = path.join(themeSourcePath, manifestPath);
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

        // 10. 테마가 이미 설치되어 있는지 확인
        // scope가 있으면 프리미엄 → custom-themes/, 없으면 → themes/
        const installDir = scope ? CUSTOM_THEMES_DIR : THEMES_DIR;
        const targetPath = path.join(installDir, manifest.id);

        // 양쪽 디렉토리 모두 확인
        if (existsSync(path.join(THEMES_DIR, manifest.id)) ||
            existsSync(path.join(CUSTOM_THEMES_DIR, manifest.id))) {
            return json(
                {
                    error: '이미 설치된 테마입니다.',
                    themeId: manifest.id
                },
                { status: 409 }
            );
        }

        // 11. 대상 폴더에 복사 (.git 제외)
        await mkdir(installDir, { recursive: true });

        await copyDir(themeSourcePath, targetPath);

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
        console.error('[GitHub Install] 설치 실패:', error);

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
