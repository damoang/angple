/**
 * npm 명령어 실행 래퍼
 *
 * GitHub Packages에서 플러그인을 다운로드하기 위한 npm 명령어를 실행합니다.
 * 보안을 위해 npm install 대신 npm pack을 사용하여 postinstall 스크립트 실행을 방지합니다.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/** 패키지 정보 */
export interface PackageInfo {
    name: string;
    version: string;
    description?: string;
    author?: string;
    repository?: string;
    versions?: string[];
}

/** npm 명령어 실행 결과 */
export interface NpmResult {
    success: boolean;
    output?: string;
    error?: string;
}

/** npm 실행 옵션 */
export interface NpmExecutorOptions {
    /** 타임아웃 (밀리초, 기본 60000) */
    timeout?: number;
    /** 임시 디렉터리 */
    tempDir?: string;
}

const DEFAULT_TIMEOUT = 60000; // 60초
const GITHUB_NPM_REGISTRY = 'https://npm.pkg.github.com';

/**
 * npm Executor 클래스
 */
export class NpmExecutor {
    private timeout: number;
    private tempDir: string;

    constructor(options: NpmExecutorOptions = {}) {
        this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
        this.tempDir = options.tempDir ?? join(process.cwd(), '.tmp', 'npm-pack');
    }

    /**
     * 임시 디렉터리 생성
     */
    async ensureTempDir(): Promise<string> {
        if (!existsSync(this.tempDir)) {
            await mkdir(this.tempDir, { recursive: true });
        }
        return this.tempDir;
    }

    /**
     * 임시 디렉터리 정리
     */
    async cleanupTempDir(): Promise<void> {
        if (existsSync(this.tempDir)) {
            await rm(this.tempDir, { recursive: true, force: true });
        }
    }

    /**
     * npm pack - tarball만 다운로드 (스크립트 실행 없음)
     *
     * @param packageName - 패키지명 (예: @angple/plugin-xxx)
     * @param version - 버전 (예: latest, 1.0.0, ^1.0.0)
     * @param outputDir - 출력 디렉터리
     * @param token - GitHub Personal Access Token (private 패키지용)
     * @returns tarball 파일 경로
     */
    async pack(
        packageName: string,
        version: string = 'latest',
        outputDir?: string,
        token?: string
    ): Promise<string> {
        const targetDir = outputDir ?? (await this.ensureTempDir());

        // 환경변수 설정 (토큰은 환경변수로 전달하여 .npmrc 파일 생성 불필요)
        const env: NodeJS.ProcessEnv = { ...process.env };

        if (token) {
            env['NPM_CONFIG_//npm.pkg.github.com/:_authToken'] = token;
        }

        // npm pack 명령어 구성
        const versionSpec = version ? `@${version}` : '';
        const command = `npm pack ${packageName}${versionSpec} --registry=${GITHUB_NPM_REGISTRY} --pack-destination="${targetDir}"`;

        console.log(`📦 [npm-executor] Executing: npm pack ${packageName}${versionSpec}`);

        try {
            const { stdout, stderr } = await execAsync(command, {
                env,
                timeout: this.timeout,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

            if (stderr && !stderr.includes('npm warn')) {
                console.warn('[npm-executor] stderr:', stderr);
            }

            // stdout에서 생성된 파일명 추출
            const lines = stdout.trim().split('\n');
            const tarballName = lines[lines.length - 1];

            if (!tarballName || !tarballName.endsWith('.tgz')) {
                throw new Error(`예상치 못한 npm pack 출력: ${stdout}`);
            }

            const tarballPath = join(targetDir, tarballName);
            console.log(`✅ [npm-executor] Tarball created: ${tarballPath}`);

            return tarballPath;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // 일반적인 오류 메시지 변환
            if (message.includes('404')) {
                throw new Error(`패키지를 찾을 수 없습니다: ${packageName}`);
            }
            if (message.includes('401') || message.includes('403')) {
                throw new Error(`인증 실패: 유효한 GitHub 토큰이 필요합니다.`);
            }
            if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
                throw new Error(`타임아웃: npm pack 명령이 시간 내에 완료되지 않았습니다.`);
            }

            throw new Error(`npm pack 실패: ${message}`);
        }
    }

    /**
     * npm view - 패키지 정보 조회
     *
     * @param packageName - 패키지명
     * @param token - GitHub Personal Access Token
     * @returns 패키지 정보
     */
    async getPackageInfo(packageName: string, token?: string): Promise<PackageInfo> {
        const env: NodeJS.ProcessEnv = { ...process.env };

        if (token) {
            env['NPM_CONFIG_//npm.pkg.github.com/:_authToken'] = token;
        }

        const command = `npm view ${packageName} --registry=${GITHUB_NPM_REGISTRY} --json`;

        console.log(`🔍 [npm-executor] Getting package info: ${packageName}`);

        try {
            const { stdout } = await execAsync(command, {
                env,
                timeout: this.timeout
            });

            const data = JSON.parse(stdout);

            return {
                name: data.name,
                version: data.version,
                description: data.description,
                author: typeof data.author === 'string' ? data.author : data.author?.name,
                repository:
                    typeof data.repository === 'string' ? data.repository : data.repository?.url,
                versions: data.versions
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            if (message.includes('404') || message.includes('E404')) {
                throw new Error(`패키지를 찾을 수 없습니다: ${packageName}`);
            }
            if (message.includes('401') || message.includes('403')) {
                throw new Error(`인증 실패: 유효한 GitHub 토큰이 필요합니다.`);
            }

            throw new Error(`패키지 정보 조회 실패: ${message}`);
        }
    }

    /**
     * 패키지 존재 여부 확인
     */
    async packageExists(packageName: string, token?: string): Promise<boolean> {
        try {
            await this.getPackageInfo(packageName, token);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 사용 가능한 버전 목록 조회
     */
    async getAvailableVersions(packageName: string, token?: string): Promise<string[]> {
        const env: NodeJS.ProcessEnv = { ...process.env };

        if (token) {
            env['NPM_CONFIG_//npm.pkg.github.com/:_authToken'] = token;
        }

        const command = `npm view ${packageName} versions --registry=${GITHUB_NPM_REGISTRY} --json`;

        try {
            const { stdout } = await execAsync(command, {
                env,
                timeout: this.timeout
            });

            const versions = JSON.parse(stdout);
            return Array.isArray(versions) ? versions : [versions];
        } catch {
            return [];
        }
    }
}

/** 싱글톤 인스턴스 */
let executorInstance: NpmExecutor | null = null;

/**
 * npm Executor 싱글톤 가져오기
 */
export function getNpmExecutor(): NpmExecutor {
    if (!executorInstance) {
        executorInstance = new NpmExecutor();
    }
    return executorInstance;
}
