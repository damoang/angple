/**
 * 테마 스캔 및 로드 함수
 *
 * themes/ 디렉터리를 스캔하여 설치된 테마 목록을 가져옵니다.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import type { ThemeManifest } from '$lib/types/theme';
import { safeValidateThemeManifest } from '$lib/types/theme';
import { sanitizePath } from '../path-utils';

/** 테마 디렉터리 경로 */
const THEMES_DIR = join(process.cwd(), 'themes');

/**
 * 테마 디렉터리가 유효한지 확인
 */
function isValidThemeDirectory(themePath: string): boolean {
    if (!existsSync(themePath)) return false;

    const stat = statSync(themePath);
    if (!stat.isDirectory()) return false;

    // theme.json 파일이 있어야 함
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const manifestPath = join(themePath, 'theme.json');
    return existsSync(manifestPath);
}

/**
 * theme.json 파일을 읽고 검증
 */
function loadThemeManifest(themeDir: string): ThemeManifest | null {
    // themeDir는 readdir()에서 온 안전한 디렉터리명
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const manifestPath = join(THEMES_DIR, themeDir, 'theme.json');

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
 * themes/ 디렉터리를 스캔하여 모든 테마 매니페스트 반환
 *
 * @returns 테마 ID를 key로 하는 매니페스트 맵
 */
export function scanThemes(): Map<string, ThemeManifest> {
    const themes = new Map<string, ThemeManifest>();

    try {
        // themes/ 디렉터리가 없으면 빈 맵 반환
        if (!existsSync(THEMES_DIR)) {
            console.warn('⚠️  [Theme Scanner] themes/ 디렉터리가 없습니다.');
            return themes;
        }

        // 디렉터리 목록 가져오기
        const entries = readdirSync(THEMES_DIR, { withFileTypes: true });

        for (const entry of entries) {
            // 디렉터리만 처리
            if (!entry.isDirectory()) continue;

            const themeDir = entry.name;
            const themePath = join(THEMES_DIR, themeDir);

            // 유효한 테마 디렉터리인지 확인
            if (!isValidThemeDirectory(themePath)) {
                console.warn(`⚠️  [Theme Scanner] 유효하지 않은 테마: ${themeDir}`);
                continue;
            }

            // 매니페스트 로드 및 검증
            const manifest = loadThemeManifest(themeDir);
            if (!manifest) continue;

            // 디렉터리 이름과 ID가 일치하는지 확인
            if (manifest.id !== themeDir) {
                console.warn(
                    `⚠️  [Theme Scanner] 테마 ID 불일치: 디렉터리명=${themeDir}, manifest.id=${manifest.id}`
                );
                console.warn('   디렉터리 이름을 테마 ID로 사용합니다.');
            }

            themes.set(manifest.id, manifest);
        }

        console.log(`✅ [Theme Scanner] ${themes.size}개 테마 스캔 완료`);
    } catch (error) {
        console.error('❌ [Theme Scanner] 테마 스캔 실패:', error);
    }

    return themes;
}

/**
 * 특정 테마의 매니페스트 가져오기
 */
export function getThemeManifest(themeId: string): ThemeManifest | null {
    const sanitizedId = sanitizePath(themeId);
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const themePath = join(THEMES_DIR, sanitizedId);

    if (!isValidThemeDirectory(themePath)) {
        return null;
    }

    return loadThemeManifest(sanitizedId);
}

/**
 * 테마 디렉터리 절대 경로 반환
 */
export function getThemePath(themeId: string): string {
    const sanitizedId = sanitizePath(themeId);
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    return join(THEMES_DIR, sanitizedId);
}

/**
 * 테마가 설치되어 있는지 확인
 */
export function isThemeInstalled(themeId: string): boolean {
    const sanitizedId = sanitizePath(themeId);
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const themePath = join(THEMES_DIR, sanitizedId);
    return isValidThemeDirectory(themePath);
}
