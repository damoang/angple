/**
 * GitHub Packages 기반 플러그인 설치기
 *
 * npm pack으로 다운로드한 tarball을 압축 해제하고
 * 보안 검증 후 custom-extensions/ 디렉터리에 설치합니다.
 */

import { createReadStream } from 'fs';
import { mkdir, rm, rename, readFile, copyFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, basename, dirname } from 'path';
import { createGunzip } from 'zlib';
import { extract } from 'tar';
import type { ExtensionManifest } from '@angple/types';
import { getNpmExecutor, type PackageInfo } from './npm-executor';
import { getTokenProvider } from '../github-tokens';
import { validatePluginSecurity } from '../plugin-security';

/** 설치 요청 */
export interface InstallRequest {
    /** 패키지명 (예: @angple/plugin-xxx 또는 @angple/plugin-xxx@1.0.0) */
    packageName: string;
    /** 버전 (옵션, packageName에 포함될 수 있음) */
    version?: string;
    /** Private 저장소 여부 */
    isPrivate?: boolean;
    /** GitHub Personal Access Token (private 저장소용) */
    token?: string;
    /** 토큰 저장 여부 */
    saveToken?: boolean;
}

/** 설치 결과 */
export interface InstallResult {
    success: boolean;
    pluginId?: string;
    manifest?: ExtensionManifest;
    error?: string;
}

/** 파싱된 패키지 정보 */
interface ParsedPackageName {
    scope: string;
    name: string;
    fullName: string;
    version: string;
}

/**
 * 프로젝트 루트 가져오기
 */
function getProjectRoot(): string {
    const cwd = process.cwd();
    if (cwd.includes('apps/web')) {
        return resolve(cwd, '../..');
    }
    if (cwd.includes('apps/admin')) {
        return resolve(cwd, '../..');
    }
    return cwd;
}

/** custom-extensions 디렉터리 */
const CUSTOM_EXTENSIONS_DIR = join(getProjectRoot(), 'custom-extensions');

/**
 * 패키지명 파싱
 *
 * @example parsePackageName('@angple/plugin-xxx') // { scope: '@angple', name: 'plugin-xxx', version: 'latest' }
 * @example parsePackageName('@angple/plugin-xxx@1.0.0') // { scope: '@angple', name: 'plugin-xxx', version: '1.0.0' }
 */
function parsePackageName(input: string): ParsedPackageName {
    // @scope/name@version 형식 파싱
    const match = input.match(/^(@[a-z0-9-]+\/[a-z0-9-]+)(?:@(.+))?$/i);

    if (!match) {
        throw new Error(`잘못된 패키지명 형식: ${input}. @scope/package-name 형식이어야 합니다.`);
    }

    const fullName = match[1];
    const version = match[2] || 'latest';

    // scope와 name 분리
    const [scope, name] = fullName.split('/');

    return {
        scope,
        name,
        fullName,
        version
    };
}

/**
 * GitHub URL에서 패키지명 추출
 *
 * @example extractFromGitHubUrl('https://github.com/angple/plugin-xxx')
 */
function extractFromGitHubUrl(url: string): string | null {
    const match = url.match(/github\.com\/([a-z0-9-]+)\/([a-z0-9-]+)/i);
    if (match) {
        return `@${match[1]}/${match[2]}`;
    }
    return null;
}

/**
 * tarball 압축 해제
 */
async function extractTarball(tarballPath: string, targetDir: string): Promise<string> {
    // 임시 디렉터리 생성
    if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        createReadStream(tarballPath)
            .pipe(createGunzip())
            .pipe(
                extract({
                    cwd: targetDir,
                    strip: 1 // 최상위 'package/' 디렉터리 제거
                })
            )
            .on('finish', () => {
                console.log(`✅ [GitHub Installer] Tarball extracted to: ${targetDir}`);
                resolve(targetDir);
            })
            .on('error', (error) => {
                console.error('[GitHub Installer] Extract error:', error);
                reject(new Error(`Tarball 압축 해제 실패: ${error.message}`));
            });
    });
}

/**
 * extension.json 또는 plugin.json 매니페스트 읽기
 */
async function readManifest(dir: string): Promise<ExtensionManifest> {
    // extension.json 우선, 없으면 plugin.json
    const manifestNames = ['extension.json', 'plugin.json'];

    for (const name of manifestNames) {
        // name은 하드코딩된 상수 배열에서만 사용됨
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const manifestPath = join(dir, name);
        if (existsSync(manifestPath)) {
            const content = await readFile(manifestPath, 'utf-8');
            return JSON.parse(content) as ExtensionManifest;
        }
    }

    throw new Error('extension.json 또는 plugin.json 파일을 찾을 수 없습니다.');
}

/**
 * 디렉터리 내 모든 파일 목록 가져오기 (재귀)
 */
async function listAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        // entry.name은 fs.readdir에서 반환된 안전한 파일명
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const fullPath = join(dir, entry.name);
        const relativePath = fullPath.replace(baseDir + '/', '');

        if (entry.isDirectory()) {
            files.push(...(await listAllFiles(fullPath, baseDir)));
        } else {
            files.push(relativePath);
        }
    }

    return files;
}

/**
 * 디렉터리 복사 (재귀)
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        // entry.name은 fs.readdir에서 반환된 안전한 파일명
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await copyFile(srcPath, destPath);
        }
    }
}

/**
 * GitHub 플러그인 설치기 클래스
 */
export class GitHubPluginInstaller {
    private npmExecutor = getNpmExecutor();
    private tokenProvider = getTokenProvider();

    /**
     * 플러그인 설치
     */
    async install(request: InstallRequest): Promise<InstallResult> {
        let tempDir: string | null = null;

        try {
            // 1. 패키지명 파싱
            let packageName = request.packageName;

            // GitHub URL 처리
            if (packageName.startsWith('https://github.com')) {
                const extracted = extractFromGitHubUrl(packageName);
                if (!extracted) {
                    throw new Error('잘못된 GitHub URL 형식입니다.');
                }
                packageName = extracted;
            }

            const packageInfo = parsePackageName(packageName);
            const version = request.version || packageInfo.version;

            console.log(`📦 [GitHub Installer] 설치 시작: ${packageInfo.fullName}@${version}`);

            // 2. 토큰 획득
            const token = await this.resolveToken(
                packageInfo.scope,
                request.token,
                request.isPrivate
            );

            // 3. npm pack으로 tarball 다운로드
            tempDir = join(getProjectRoot(), '.tmp', `install-${Date.now()}`);
            await mkdir(tempDir, { recursive: true });

            const tarballPath = await this.npmExecutor.pack(
                packageInfo.fullName,
                version,
                tempDir,
                token
            );

            // 4. tarball 압축 해제
            const extractedDir = join(tempDir, 'extracted');
            await extractTarball(tarballPath, extractedDir);

            // 5. 매니페스트 읽기 및 검증
            const manifest = await readManifest(extractedDir);

            if (!manifest.id) {
                throw new Error('매니페스트에 id 필드가 없습니다.');
            }

            // 6. 보안 검증
            const files = await listAllFiles(extractedDir);
            const securityResult = await validatePluginSecurity(files, extractedDir);

            if (!securityResult.valid) {
                throw new Error(`보안 검증 실패:\n${securityResult.errors.join('\n')}`);
            }

            // 7. custom-extensions/{id}/에 설치
            const installDir = join(CUSTOM_EXTENSIONS_DIR, manifest.id);

            // 기존 설치 확인
            if (existsSync(installDir)) {
                console.log(
                    `⚠️  [GitHub Installer] 기존 설치 발견, 업데이트합니다: ${manifest.id}`
                );
                await rm(installDir, { recursive: true, force: true });
            }

            await copyDirectory(extractedDir, installDir);

            // 8. 토큰 저장 (요청 시)
            if (request.saveToken && request.token) {
                await this.tokenProvider.setToken(packageInfo.scope, request.token);
                console.log(`✅ [GitHub Installer] 토큰 저장됨: ${packageInfo.scope}`);
            }

            console.log(`✅ [GitHub Installer] 설치 완료: ${manifest.id} v${manifest.version}`);

            return {
                success: true,
                pluginId: manifest.id,
                manifest
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[GitHub Installer] 설치 실패:', message);

            return {
                success: false,
                error: message
            };
        } finally {
            // 임시 디렉터리 정리
            if (tempDir && existsSync(tempDir)) {
                await rm(tempDir, { recursive: true, force: true });
            }
        }
    }

    /**
     * 토큰 획득 (저장된 토큰 또는 입력된 토큰)
     */
    private async resolveToken(
        scope: string,
        providedToken?: string,
        isPrivate?: boolean
    ): Promise<string | undefined> {
        // 제공된 토큰이 있으면 사용
        if (providedToken) {
            return providedToken;
        }

        // Private 저장소면 저장된 토큰 찾기
        if (isPrivate) {
            const savedToken = await this.tokenProvider.getToken(scope);
            if (savedToken) {
                console.log(`🔑 [GitHub Installer] 저장된 토큰 사용: ${scope}`);
                return savedToken;
            }

            throw new Error(
                `Private 저장소 접근을 위한 토큰이 필요합니다. ` +
                    `${scope} 스코프의 저장된 토큰이 없습니다.`
            );
        }

        // Public 저장소는 토큰 없이 시도
        return undefined;
    }

    /**
     * 패키지 정보 미리보기
     */
    async preview(
        packageName: string,
        token?: string
    ): Promise<{
        success: boolean;
        packageInfo?: PackageInfo;
        error?: string;
    }> {
        try {
            // GitHub URL 처리
            if (packageName.startsWith('https://github.com')) {
                const extracted = extractFromGitHubUrl(packageName);
                if (!extracted) {
                    throw new Error('잘못된 GitHub URL 형식입니다.');
                }
                packageName = extracted;
            }

            const parsed = parsePackageName(packageName);

            // 토큰 해결
            const resolvedToken = token || (await this.tokenProvider.getToken(parsed.scope));

            const packageInfo = await this.npmExecutor.getPackageInfo(
                parsed.fullName,
                resolvedToken || undefined
            );

            return { success: true, packageInfo };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

/** 싱글톤 인스턴스 */
let installerInstance: GitHubPluginInstaller | null = null;

/**
 * GitHub 플러그인 설치기 싱글톤 가져오기
 */
export function getGitHubInstaller(): GitHubPluginInstaller {
    if (!installerInstance) {
        installerInstance = new GitHubPluginInstaller();
    }
    return installerInstance;
}
