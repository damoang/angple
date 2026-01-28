/**
 * 플러그인 파일 보안 검증
 *
 * 업로드/설치된 플러그인 파일의 보안을 검증합니다.
 * theme-security.ts를 기반으로 플러그인에 맞게 확장되었습니다.
 */

import { readFile, stat } from 'fs/promises';
import path from 'path';

/**
 * 허용된 파일 확장자 (화이트리스트)
 * 플러그인은 테마보다 더 많은 파일 타입을 허용
 */
const PLUGIN_ALLOWED_EXTENSIONS = [
    // 코드 파일
    '.ts',
    '.js',
    '.mts',
    '.mjs',
    '.d.ts',
    '.svelte',
    '.vue',

    // 설정 파일
    '.json',
    '.yaml',
    '.yml',

    // 스타일 파일
    '.css',
    '.scss',
    '.sass',
    '.less',

    // 문서 파일
    '.md',
    '.txt',

    // 이미지 파일
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.ico',

    // 폰트 파일
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',

    // 기타
    '.html'
];

/**
 * 파일 크기 제한
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB 개별 파일
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB 전체 (플러그인은 더 클 수 있음)

/**
 * 악성 패턴 (정규식)
 * 서버 사이드에서 실행될 수 있는 위험한 코드 패턴
 */
const MALICIOUS_PATTERNS = [
    // Node.js 위험 모듈 직접 접근
    /require\s*\(\s*['"]child_process['"]\s*\)/gi,
    /require\s*\(\s*['"]fs['"]\s*\)/gi,
    /require\s*\(\s*['"]net['"]\s*\)/gi,
    /require\s*\(\s*['"]dgram['"]\s*\)/gi,
    /require\s*\(\s*['"]cluster['"]\s*\)/gi,

    // 동적 import (위험 모듈)
    /import\s*\(\s*['"]child_process['"]\s*\)/gi,
    /import\s*\(\s*['"]fs['"]\s*\)/gi,

    // 프로세스 조작
    /process\.exit/gi,
    /process\.kill/gi,

    // 동적 코드 실행
    /eval\s*\(/gi,
    /Function\s*\(\s*[^)]*\)\s*\(/gi,
    /new\s+Function\s*\(/gi,

    // 위험한 전역 조작
    /global\[/gi,
    /globalThis\[/gi,

    // 쉘 명령어 실행 패턴
    /execSync\s*\(/gi,
    /spawnSync\s*\(/gi,
    /exec\s*\(\s*['"`]/gi
];

/**
 * 경고 패턴 (허용되지만 주의 필요)
 */
const WARNING_PATTERNS = [
    // 브라우저 저장소 접근 (클라이언트에서는 허용)
    /localStorage\./gi,
    /sessionStorage\./gi,
    /document\.cookie/gi,

    // 네트워크 요청 (허용되지만 기록)
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi
];

/** 검증 결과 */
export interface SecurityValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/** 파일 정보 */
export interface FileInfo {
    path: string;
    size: number;
}

/**
 * 파일 확장자 검증
 */
function isAllowedExtension(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return PLUGIN_ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * 텍스트 파일인지 확인
 */
function isTextFile(filename: string): boolean {
    const textExtensions = [
        '.ts',
        '.js',
        '.mts',
        '.mjs',
        '.d.ts',
        '.svelte',
        '.vue',
        '.json',
        '.yaml',
        '.yml',
        '.css',
        '.scss',
        '.sass',
        '.less',
        '.md',
        '.txt',
        '.html'
    ];
    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext);
}

/**
 * 파일 크기 검증
 */
export function validateFileSizes(files: FileInfo[]): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    let totalSize = 0;

    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            errors.push(
                `파일 크기 초과: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB)`
            );
        }
        totalSize += file.size;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
        errors.push(`전체 플러그인 크기 초과: ${(totalSize / 1024 / 1024).toFixed(2)}MB > 100MB`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * 파일 내용 스캔
 */
async function scanFileContent(filePath: string): Promise<{
    safe: boolean;
    patterns: string[];
    warnings: string[];
}> {
    if (!isTextFile(filePath)) {
        return { safe: true, patterns: [], warnings: [] };
    }

    try {
        const content = await readFile(filePath, 'utf-8');
        const detectedPatterns: string[] = [];
        const detectedWarnings: string[] = [];

        // 악성 패턴 검사
        for (const pattern of MALICIOUS_PATTERNS) {
            // 정규식 재설정 (lastIndex 문제 방지)
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
                detectedPatterns.push(pattern.source);
            }
        }

        // 경고 패턴 검사
        for (const pattern of WARNING_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
                detectedWarnings.push(pattern.source);
            }
        }

        return {
            safe: detectedPatterns.length === 0,
            patterns: detectedPatterns,
            warnings: detectedWarnings
        };
    } catch (error) {
        console.error('파일 읽기 실패:', { filePath, error });
        return { safe: false, patterns: ['FILE_READ_ERROR'], warnings: [] };
    }
}

/**
 * 플러그인 파일 전체 검증
 *
 * @param files - 파일 상대 경로 목록
 * @param extractPath - 압축 해제된 기본 경로
 */
export async function validatePluginSecurity(
    files: string[],
    extractPath: string
): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 확장자 검증
    for (const file of files) {
        if (!isAllowedExtension(file)) {
            errors.push(`허용되지 않는 파일 확장자: ${file}`);
        }
    }

    // 2. 경로 검증 (디렉터리 탈출 방지)
    for (const file of files) {
        const normalizedPath = path.normalize(file);
        if (normalizedPath.includes('..')) {
            errors.push(`잘못된 파일 경로 (디렉터리 탈출 시도): ${file}`);
        }
        if (path.isAbsolute(normalizedPath)) {
            errors.push(`절대 경로 사용 불가: ${file}`);
        }
    }

    // 3. Symlink 검증
    for (const file of files) {
        try {
            // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
            // file은 위에서 normalizedPath.includes('..') 및 isAbsolute로 이미 검증됨
            const fullPath = path.join(extractPath, file);
            const fileStat = await stat(fullPath);

            if (fileStat.isSymbolicLink()) {
                errors.push(`심볼릭 링크 사용 불가: ${file}`);
            }
        } catch {
            // 파일 stat 실패는 무시 (파일 없음 등)
        }
    }

    // 4. 악성 코드 패턴 스캔
    for (const file of files) {
        // '..' 체크 완료된 파일만 처리
        const normalizedPath = path.normalize(file);
        if (normalizedPath.includes('..')) continue;

        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
        // file은 위에서 normalizedPath.includes('..') 및 isAbsolute로 이미 검증됨
        const fullPath = path.join(extractPath, file);
        const scanResult = await scanFileContent(fullPath);

        if (!scanResult.safe) {
            errors.push(`악성 패턴 감지: ${file} - [${scanResult.patterns.join(', ')}]`);
        }

        if (scanResult.warnings.length > 0) {
            warnings.push(`주의 필요: ${file} - [${scanResult.warnings.join(', ')}]`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * 매니페스트 파일 존재 여부 확인
 */
export function hasPluginManifest(files: string[]): boolean {
    return files.some(
        (file) =>
            file === 'extension.json' ||
            file === 'plugin.json' ||
            file.endsWith('/extension.json') ||
            file.endsWith('/plugin.json')
    );
}

/**
 * 플러그인 ID가 유효한지 확인
 */
export function isValidPluginId(id: string): boolean {
    // 알파벳, 숫자, 하이픈, 언더스코어만 허용
    return /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(id);
}
