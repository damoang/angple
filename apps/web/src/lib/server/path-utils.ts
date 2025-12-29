/**
 * 경로 관련 보안 유틸리티
 */

import { basename, normalize, relative, isAbsolute } from 'path';

/**
 * Path Traversal 공격 방지를 위한 경로 검증
 *
 * @param userPath - 사용자 입력 경로
 * @param allowedChars - 허용할 추가 문자 (기본: 알파벳, 숫자, 하이픈, 언더스코어)
 * @throws Error - 유효하지 않은 경로인 경우
 * @returns 검증된 경로
 */
export function sanitizePath(userPath: string, allowedChars: RegExp = /^[a-zA-Z0-9\-_]+$/): string {
    // 경로 탐색 문자 체크
    if (userPath.includes('..') || userPath.includes('\\')) {
        throw new Error('Invalid path: path traversal detected');
    }

    // 절대 경로 체크
    if (isAbsolute(userPath)) {
        throw new Error('Invalid path: absolute paths not allowed');
    }

    // null byte 체크
    if (userPath.includes('\0')) {
        throw new Error('Invalid path: null byte detected');
    }

    // 허용된 문자만 포함하는지 체크
    if (!allowedChars.test(userPath)) {
        throw new Error('Invalid path: contains illegal characters');
    }

    return userPath;
}

/**
 * 파일명만 추출하여 안전한 경로 생성
 *
 * @param userPath - 사용자 입력 경로
 * @returns 안전한 파일명
 */
export function safeBasename(userPath: string): string {
    const filename = basename(normalize(userPath));

    // basename이어도 추가 검증
    if (filename.includes('..') || filename === '.' || filename === '') {
        throw new Error('Invalid filename');
    }

    return filename;
}

/**
 * 상대 경로가 기준 디렉터리 내부에 있는지 확인
 *
 * @param basePath - 기준 디렉터리
 * @param targetPath - 확인할 경로
 * @returns 안전한지 여부
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
    const rel = relative(basePath, targetPath);
    return !rel.startsWith('..') && !isAbsolute(rel);
}
