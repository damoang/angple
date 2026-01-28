/**
 * GitHub 토큰 프로바이더
 *
 * 토큰 저장소의 고수준 인터페이스를 제공합니다.
 * 토큰 유효성 검증 및 GitHub API 연동 기능을 포함합니다.
 */

import {
    saveToken,
    getToken,
    deleteToken,
    listScopes,
    getTokenMetadata,
    listTokensMetadata,
    type StoredToken
} from './token-store';
import { isEncryptionConfigured } from './encryption';

/** 토큰 검증 결과 */
export interface TokenValidationResult {
    valid: boolean;
    scopes?: string[];
    username?: string;
    error?: string;
}

/** 토큰 프로바이더 인터페이스 */
export interface GitHubTokenProvider {
    /** 특정 scope의 토큰 가져오기 */
    getToken(scope: string): Promise<string | null>;
    /** 토큰 저장 */
    setToken(scope: string, token: string): Promise<void>;
    /** 토큰 삭제 */
    deleteToken(scope: string): Promise<boolean>;
    /** 저장된 scope 목록 */
    listScopes(): Promise<string[]>;
    /** 토큰 유효성 검증 (GitHub API 호출) */
    validateToken(token: string): Promise<TokenValidationResult>;
    /** 암호화가 설정되어 있는지 확인 */
    isConfigured(): boolean;
}

/**
 * GitHub API를 통한 토큰 유효성 검증
 */
async function validateTokenWithGitHub(token: string): Promise<TokenValidationResult> {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'Angple-Plugin-Installer'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                return { valid: false, error: '토큰이 유효하지 않습니다.' };
            }
            if (response.status === 403) {
                return { valid: false, error: '토큰 권한이 부족하거나 API 제한에 도달했습니다.' };
            }
            return { valid: false, error: `GitHub API 오류: ${response.status}` };
        }

        const user = (await response.json()) as { login: string };

        // 토큰 scope 확인
        const scopeHeader = response.headers.get('x-oauth-scopes');
        const scopes = scopeHeader ? scopeHeader.split(', ').filter(Boolean) : [];

        return {
            valid: true,
            username: user.login,
            scopes
        };
    } catch (error) {
        console.error('[Token Provider] GitHub API 호출 실패:', error);
        return {
            valid: false,
            error: error instanceof Error ? error.message : '네트워크 오류'
        };
    }
}

/**
 * GitHub Packages에 접근 가능한지 확인
 */
async function validatePackagesAccess(token: string, scope: string): Promise<TokenValidationResult> {
    const normalizedScope = scope.startsWith('@') ? scope.slice(1) : scope;

    try {
        // GitHub Packages npm registry API로 테스트
        const response = await fetch(`https://npm.pkg.github.com/-/user/orgs/${normalizedScope}/packages`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'User-Agent': 'Angple-Plugin-Installer'
            }
        });

        // 401/403은 토큰 문제, 404는 org가 없거나 패키지가 없는 경우
        if (response.status === 401) {
            return { valid: false, error: '토큰이 유효하지 않습니다.' };
        }

        if (response.status === 403) {
            return { valid: false, error: 'read:packages 권한이 필요합니다.' };
        }

        // 404도 토큰은 유효하므로 통과
        return { valid: true };
    } catch (error) {
        // 네트워크 오류 - 기본 검증으로 폴백
        return validateTokenWithGitHub(token);
    }
}

/**
 * 토큰 프로바이더 생성
 */
export function createTokenProvider(): GitHubTokenProvider {
    return {
        async getToken(scope: string): Promise<string | null> {
            if (!isEncryptionConfigured()) {
                console.warn('[Token Provider] 암호화 키가 설정되지 않았습니다.');
                return null;
            }
            return getToken(scope);
        },

        async setToken(scope: string, token: string): Promise<void> {
            if (!isEncryptionConfigured()) {
                throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다.');
            }
            await saveToken(scope, token);
        },

        async deleteToken(scope: string): Promise<boolean> {
            return deleteToken(scope);
        },

        async listScopes(): Promise<string[]> {
            return listScopes();
        },

        async validateToken(token: string): Promise<TokenValidationResult> {
            return validateTokenWithGitHub(token);
        },

        isConfigured(): boolean {
            return isEncryptionConfigured();
        }
    };
}

/** 싱글톤 인스턴스 */
let providerInstance: GitHubTokenProvider | null = null;

/**
 * 토큰 프로바이더 싱글톤 가져오기
 */
export function getTokenProvider(): GitHubTokenProvider {
    if (!providerInstance) {
        providerInstance = createTokenProvider();
    }
    return providerInstance;
}

// 편의를 위한 re-export
export { getTokenMetadata, listTokensMetadata, type StoredToken };
