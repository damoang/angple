/**
 * 테마 스캔 및 로드 함수
 *
 * themes/ 디렉터리를 스캔하여 설치된 테마 목록을 가져옵니다.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { ThemeManifest } from '$lib/types/theme';
import { safeValidateThemeManifest } from '$lib/types/theme';
import { sanitizePath } from '../path-utils';

/**
 * 프로젝트 루트 디렉터리 찾기
 * Monorepo 환경에서 apps/web이 아닌 프로젝트 루트를 반환
 */
function getProjectRoot(): string {
    const cwd = process.cwd();
    // apps/web에서 실행 중이면 2단계 위로 (../../)
    if (cwd.includes('apps/web')) {
        return resolve(cwd, '../..');
    }
    // apps/admin에서 실행 중이면 2단계 위로
    if (cwd.includes('apps/admin')) {
        return resolve(cwd, '../..');
    }
    // 이미 루트에 있으면 그대로
    return cwd;
}

const PROJECT_ROOT = getProjectRoot();

/** 공식 테마 디렉터리 경로 (Git 추적) */
const THEMES_DIR = join(PROJECT_ROOT, 'themes');

/** 커스텀 테마 디렉터리 경로 (Git 무시, 사용자 업로드) */
const CUSTOM_THEMES_DIR = join(PROJECT_ROOT, 'custom-themes');

/**
 * 테마 디렉터리가 유효한지 확인
 */
function isValidThemeDirectory(themePath: string): boolean {
    if (!existsSync(themePath)) return false;

    const stat = statSync(themePath);
    if (!stat.isDirectory()) return false;

    // theme.json 파일이 있어야 함
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const manifestPath = join(themePath, 'theme.json');
    return existsSync(manifestPath);
}

/**
 * theme.json 파일을 읽고 검증
 * @param themeDir 테마 디렉터리명 (안전한 이름, readdir에서 반환)
 * @param baseDir 테마가 위치한 기본 디렉터리 (THEMES_DIR 또는 CUSTOM_THEMES_DIR)
 */
function loadThemeManifest(themeDir: string, baseDir: string): ThemeManifest | null {
    // themeDir는 readdir()에서 온 안전한 디렉터리명
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const manifestPath = join(baseDir, themeDir, 'theme.json');

    try {
        const manifestJson = readFileSync(manifestPath, 'utf-8');
        const manifestData = JSON.parse(manifestJson);

        // Zod 검증
        const result = safeValidateThemeManifest(manifestData);

        if (!result.success) {
            console.error('❌ [Theme Scanner] 테마 검증 실패:', { themeDir });
            console.error(result.error.issues);
            return null;
        }

        return result.data;
    } catch (error) {
        console.error('❌ [Theme Scanner] 테마 매니페스트 로드 실패:', { themeDir, error });
        return null;
    }
}

/**
 * 특정 디렉터리에서 테마 스캔 헬퍼
 */
function scanDirectory(baseDir: string, themes: Map<string, ThemeManifest>): number {
    if (!existsSync(baseDir)) {
        return 0;
    }

    let scannedCount = 0;
    const entries = readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
        // 디렉터리만 처리
        if (!entry.isDirectory()) continue;

        const themeDir = entry.name;
        const themePath = join(baseDir, themeDir);

        // 유효한 테마 디렉터리인지 확인
        if (!isValidThemeDirectory(themePath)) {
            console.warn(`⚠️  [Theme Scanner] 유효하지 않은 테마: ${themeDir}`);
            continue;
        }

        // 매니페스트 로드 및 검증
        const manifest = loadThemeManifest(themeDir, baseDir);
        if (!manifest) continue;

        // 디렉터리 이름과 ID가 일치하는지 확인
        if (manifest.id !== themeDir) {
            console.warn(
                `⚠️  [Theme Scanner] 테마 ID 불일치: 디렉터리명=${themeDir}, manifest.id=${manifest.id}`
            );
            console.warn('   디렉터리 이름을 테마 ID로 사용합니다.');
        }

        themes.set(manifest.id, manifest);
        scannedCount++;
    }

    return scannedCount;
}

/**
 * themes/ 및 custom-themes/ 디렉터리를 스캔하여 모든 테마 매니페스트 반환
 *
 * @returns 테마 ID를 key로 하는 매니페스트 맵
 */
export function scanThemes(): Map<string, ThemeManifest> {
    const themes = new Map<string, ThemeManifest>();

    try {
        // 공식 테마 스캔 (Git 추적)
        const officialCount = scanDirectory(THEMES_DIR, themes);

        // 커스텀 테마 스캔 (사용자 업로드)
        const customCount = scanDirectory(CUSTOM_THEMES_DIR, themes);

        console.log(
            `✅ [Theme Scanner] 총 ${themes.size}개 테마 스캔 완료 (공식: ${officialCount}, 커스텀: ${customCount})`
        );
    } catch (error) {
        console.error('❌ [Theme Scanner] 테마 스캔 실패:', error);
    }

    return themes;
}

/**
 * 테마가 어느 디렉터리에 있는지 찾기
 * @returns [baseDir, isCustom] 튜플 또는 null
 */
function findThemeDirectory(themeId: string): [string, boolean] | null {
    const sanitizedId = sanitizePath(themeId);

    // 1. 공식 테마 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const officialPath = join(THEMES_DIR, sanitizedId);
    if (isValidThemeDirectory(officialPath)) {
        return [THEMES_DIR, false];
    }

    // 2. 커스텀 테마 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const customPath = join(CUSTOM_THEMES_DIR, sanitizedId);
    if (isValidThemeDirectory(customPath)) {
        return [CUSTOM_THEMES_DIR, true];
    }

    return null;
}

/**
 * 특정 테마의 매니페스트 가져오기
 */
export function getThemeManifest(themeId: string): ThemeManifest | null {
    const result = findThemeDirectory(themeId);
    if (!result) return null;

    const [baseDir] = result;
    const sanitizedId = sanitizePath(themeId);
    return loadThemeManifest(sanitizedId, baseDir);
}

/**
 * 테마 디렉터리 절대 경로 반환
 */
export function getThemePath(themeId: string): string {
    const result = findThemeDirectory(themeId);
    const sanitizedId = sanitizePath(themeId);

    if (!result) {
        // 기본적으로 공식 테마 경로 반환 (호환성 유지)
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        return join(THEMES_DIR, sanitizedId);
    }

    const [baseDir] = result;
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return join(baseDir, sanitizedId);
}

/**
 * 테마가 설치되어 있는지 확인
 */
export function isThemeInstalled(themeId: string): boolean {
    return findThemeDirectory(themeId) !== null;
}

/**
 * 테마가 커스텀 테마인지 확인
 */
export function isCustomTheme(themeId: string): boolean {
    const result = findThemeDirectory(themeId);
    return result ? result[1] : false;
}
