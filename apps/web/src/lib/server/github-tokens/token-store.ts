/**
 * GitHub 토큰 저장소
 *
 * 암호화된 토큰을 JSON 파일에 저장합니다.
 * 저장 위치: data/github-tokens.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { encrypt, decrypt } from './encryption';

/** 토큰 저장 인터페이스 */
export interface StoredToken {
    /** GitHub scope (예: @angple, @damoang) */
    scope: string;
    /** 암호화된 토큰 */
    encryptedToken: string;
    /** 생성 시각 (ISO 8601) */
    createdAt: string;
    /** 마지막 사용 시각 (ISO 8601) */
    lastUsedAt?: string;
}

/** 토큰 저장소 파일 구조 */
interface TokenStoreData {
    version: number;
    tokens: StoredToken[];
}

/** 현재 저장소 버전 */
const STORE_VERSION = 1;

/**
 * 프로젝트 루트 디렉터리 가져오기
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

/**
 * 토큰 저장소 파일 경로
 */
function getTokenStorePath(): string {
    const projectRoot = getProjectRoot();
    return join(projectRoot, 'data', 'github-tokens.json');
}

/**
 * 데이터 디렉터리 확인 및 생성
 */
async function ensureDataDir(): Promise<void> {
    const projectRoot = getProjectRoot();
    const dataDir = join(projectRoot, 'data');

    if (!existsSync(dataDir)) {
        await mkdir(dataDir, { recursive: true });
    }
}

/**
 * 저장소 파일 읽기
 */
async function readStore(): Promise<TokenStoreData> {
    const storePath = getTokenStorePath();

    if (!existsSync(storePath)) {
        return { version: STORE_VERSION, tokens: [] };
    }

    try {
        const content = await readFile(storePath, 'utf-8');
        const data = JSON.parse(content) as TokenStoreData;

        // 버전 체크 (향후 마이그레이션 지원)
        if (data.version !== STORE_VERSION) {
            console.warn(
                `[Token Store] 버전 불일치: 저장소=${data.version}, 현재=${STORE_VERSION}`
            );
        }

        return data;
    } catch (error) {
        console.error('[Token Store] 저장소 읽기 실패:', error);
        return { version: STORE_VERSION, tokens: [] };
    }
}

/**
 * 저장소 파일 쓰기
 */
async function writeStore(data: TokenStoreData): Promise<void> {
    await ensureDataDir();
    const storePath = getTokenStorePath();

    await writeFile(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 토큰 저장
 *
 * @param scope - GitHub scope (예: @angple)
 * @param token - 평문 토큰
 */
export async function saveToken(scope: string, token: string): Promise<void> {
    // scope 정규화 (@ 접두사 보장)
    const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;

    // 토큰 암호화
    const encryptedToken = encrypt(token);

    const store = await readStore();
    const now = new Date().toISOString();

    // 기존 토큰 찾기
    const existingIndex = store.tokens.findIndex((t) => t.scope === normalizedScope);

    if (existingIndex >= 0) {
        // 기존 토큰 업데이트
        store.tokens[existingIndex] = {
            scope: normalizedScope,
            encryptedToken,
            createdAt: store.tokens[existingIndex].createdAt,
            lastUsedAt: now
        };
    } else {
        // 새 토큰 추가
        store.tokens.push({
            scope: normalizedScope,
            encryptedToken,
            createdAt: now
        });
    }

    await writeStore(store);
    console.log(`✅ [Token Store] 토큰 저장됨: ${normalizedScope}`);
}

/**
 * 토큰 가져오기 (복호화)
 *
 * @param scope - GitHub scope (예: @angple)
 * @returns 복호화된 토큰 또는 null
 */
export async function getToken(scope: string): Promise<string | null> {
    const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;

    const store = await readStore();
    const tokenEntry = store.tokens.find((t) => t.scope === normalizedScope);

    if (!tokenEntry) {
        return null;
    }

    try {
        const token = decrypt(tokenEntry.encryptedToken);

        // 마지막 사용 시각 업데이트
        tokenEntry.lastUsedAt = new Date().toISOString();
        await writeStore(store);

        return token;
    } catch (error) {
        // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
        console.error('[Token Store] 토큰 복호화 실패:', normalizedScope, error);
        return null;
    }
}

/**
 * 토큰 삭제
 *
 * @param scope - GitHub scope
 * @returns 삭제 성공 여부
 */
export async function deleteToken(scope: string): Promise<boolean> {
    const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;

    const store = await readStore();
    const initialLength = store.tokens.length;

    store.tokens = store.tokens.filter((t) => t.scope !== normalizedScope);

    if (store.tokens.length < initialLength) {
        await writeStore(store);
        console.log(`✅ [Token Store] 토큰 삭제됨: ${normalizedScope}`);
        return true;
    }

    return false;
}

/**
 * 저장된 모든 scope 목록 가져오기
 */
export async function listScopes(): Promise<string[]> {
    const store = await readStore();
    return store.tokens.map((t) => t.scope);
}

/**
 * 저장된 토큰 메타데이터 가져오기 (토큰 값 제외)
 */
export async function getTokenMetadata(
    scope: string
): Promise<Omit<StoredToken, 'encryptedToken'> | null> {
    const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;

    const store = await readStore();
    const tokenEntry = store.tokens.find((t) => t.scope === normalizedScope);

    if (!tokenEntry) {
        return null;
    }

    // 암호화된 토큰은 제외
    const { encryptedToken, ...metadata } = tokenEntry;
    return metadata;
}

/**
 * 모든 토큰 메타데이터 가져오기
 */
export async function listTokensMetadata(): Promise<Omit<StoredToken, 'encryptedToken'>[]> {
    const store = await readStore();
    return store.tokens.map(({ encryptedToken, ...metadata }) => metadata);
}
