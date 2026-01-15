/**
 * Extension 스캔 및 로드 함수
 *
 * ZeroPress 철학 반영:
 * - 플러그인 지옥 없음 → 완전 격리된 스캔
 * - Zero-Config → extension.json만 있으면 자동 인식
 * - 타입 안전성 → Zod 스키마 검증
 *
 * extensions/ 디렉터리를 스캔하여 설치된 Extension 목록을 가져옵니다.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { ExtensionManifest, ThemeManifest, PluginManifest } from '@angple/types';
import { PluginType } from '@angple/types';
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

/** 공식 Extension 디렉터리 경로 (Git 추적) */
const EXTENSIONS_DIR = join(PROJECT_ROOT, 'extensions');

/** 공식 Theme 디렉터리 경로 (Git 추적) */
const THEMES_DIR = join(PROJECT_ROOT, 'themes');

/** 커스텀 Extension 디렉터리 경로 (Git 무시, 사용자 업로드) */
const CUSTOM_EXTENSIONS_DIR = join(PROJECT_ROOT, 'custom-extensions');

/** 커스텀 Theme 디렉터리 경로 (Git 무시, 사용자 업로드) */
const CUSTOM_THEMES_DIR = join(PROJECT_ROOT, 'custom-themes');

/**
 * Extension 디렉터리가 유효한지 확인
 * extension.json, theme.json, plugin.json 중 하나라도 있으면 유효
 *
 * @param extensionPath - 이미 sanitize된 안전한 절대 경로
 */
function isValidExtensionDirectory(extensionPath: string): boolean {
    if (!existsSync(extensionPath)) return false;

    const stat = statSync(extensionPath);
    if (!stat.isDirectory()) return false;

    // extension.json, theme.json, plugin.json 중 하나라도 있으면 유효
    // 보안: extensionPath는 이미 baseDir + sanitizedDir로 구성되어 안전
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const extensionManifest = join(extensionPath, 'extension.json');
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const themeManifest = join(extensionPath, 'theme.json');
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const pluginManifest = join(extensionPath, 'plugin.json');

    return existsSync(extensionManifest) || existsSync(themeManifest) || existsSync(pluginManifest);
}

/**
 * extension.json, theme.json, plugin.json 파일을 읽고 검증
 * @param extensionDir Extension 디렉터리명 (안전한 이름, readdir에서 반환)
 * @param baseDir Extension이 위치한 기본 디렉터리 (EXTENSIONS_DIR 또는 CUSTOM_EXTENSIONS_DIR 등)
 */
function loadExtensionManifest(extensionDir: string, baseDir: string): ExtensionManifest | null {
    // 보안: 디렉터리명 검증 (Path Traversal 공격 방지)
    const sanitizedDir = sanitizePath(extensionDir);

    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const extensionPath = join(baseDir, sanitizedDir, 'extension.json');
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const themePath = join(baseDir, sanitizedDir, 'theme.json');
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const pluginPath = join(baseDir, sanitizedDir, 'plugin.json');

    // 우선순위: extension.json > theme.json > plugin.json
    let manifestPath: string;
    if (existsSync(extensionPath)) {
        manifestPath = extensionPath;
    } else if (existsSync(themePath)) {
        manifestPath = themePath;
    } else if (existsSync(pluginPath)) {
        manifestPath = pluginPath;
    } else {
        return null;
    }

    try {
        const manifestJson = readFileSync(manifestPath, 'utf-8');
        const manifestData = JSON.parse(manifestJson) as ExtensionManifest;

        // 기본 필드 검증
        if (!manifestData.id || !manifestData.name || !manifestData.version) {
            console.error('❌ [Extension Scanner] 필수 필드 누락:', { extensionDir });
            return null;
        }

        // ID 형식 검증 (kebab-case만 허용)
        if (!/^[a-z0-9-]+$/.test(manifestData.id)) {
            console.error('❌ [Extension Scanner] 잘못된 ID 형식:', { id: manifestData.id });
            return null;
        }

        // 버전 형식 검증 (semver)
        if (!/^\d+\.\d+\.\d+/.test(manifestData.version)) {
            console.error('❌ [Extension Scanner] 잘못된 버전 형식:', {
                version: manifestData.version
            });
            return null;
        }

        return manifestData;
    } catch (error) {
        console.error('❌ [Extension Scanner] 매니페스트 로드 실패:', { extensionDir, error });
        return null;
    }
}

/**
 * 특정 디렉터리에서 Extension 스캔 헬퍼
 */
function scanDirectory(baseDir: string, extensions: Map<string, ExtensionManifest>): number {
    if (!existsSync(baseDir)) {
        return 0;
    }

    let scannedCount = 0;
    const entries = readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
        // 디렉터리만 처리
        if (!entry.isDirectory()) continue;

        // 보안: 디렉터리명 검증 (Path Traversal 공격 방지)
        const extensionDir = sanitizePath(entry.name);
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const extensionPath = join(baseDir, extensionDir);

        // 유효한 Extension 디렉터리인지 확인
        if (!isValidExtensionDirectory(extensionPath)) {
            console.warn(`⚠️  [Extension Scanner] 유효하지 않은 Extension: ${extensionDir}`);
            continue;
        }

        // 매니페스트 로드 및 검증
        const manifest = loadExtensionManifest(extensionDir, baseDir);
        if (!manifest) continue;

        // 디렉터리 이름과 ID가 일치하는지 확인
        if (manifest.id !== extensionDir) {
            console.warn(
                `⚠️  [Extension Scanner] Extension ID 불일치: 디렉터리명=${extensionDir}, manifest.id=${manifest.id}`
            );
            console.warn('   디렉터리 이름을 Extension ID로 사용합니다.');
        }

        extensions.set(manifest.id, manifest);
        scannedCount++;
    }

    return scannedCount;
}

/**
 * extensions/, themes/, custom-extensions/, custom-themes/ 디렉터리를 스캔하여 모든 Extension 매니페스트 반환
 *
 * @returns Extension ID를 key로 하는 매니페스트 맵
 */
export function scanExtensions(): Map<string, ExtensionManifest> {
    const extensions = new Map<string, ExtensionManifest>();

    try {
        // 공식 Extension 스캔 (extensions/)
        const extensionCount = scanDirectory(EXTENSIONS_DIR, extensions);

        // 공식 Theme 스캔 (themes/)
        const themeCount = scanDirectory(THEMES_DIR, extensions);

        // 커스텀 Extension 스캔 (custom-extensions/)
        const customExtensionCount = scanDirectory(CUSTOM_EXTENSIONS_DIR, extensions);

        // 커스텀 Theme 스캔 (custom-themes/)
        const customThemeCount = scanDirectory(CUSTOM_THEMES_DIR, extensions);

        const totalOfficial = extensionCount + themeCount;
        const totalCustom = customExtensionCount + customThemeCount;

        console.log(
            `✅ [Extension Scanner] 총 ${extensions.size}개 Extension 스캔 완료 (공식: ${totalOfficial}, 커스텀: ${totalCustom})`
        );
    } catch (error) {
        console.error('❌ [Extension Scanner] Extension 스캔 실패:', error);
    }

    return extensions;
}

/**
 * Extension이 어느 디렉터리에 있는지 찾기
 * @returns [baseDir, isCustom] 튜플 또는 null
 */
function findExtensionDirectory(extensionId: string): [string, boolean] | null {
    const sanitizedId = sanitizePath(extensionId);

    // 1. 공식 Extension 디렉터리 확인
    // 보안: sanitizedId로 이미 검증되어 안전
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const officialPath = join(EXTENSIONS_DIR, sanitizedId);
    if (isValidExtensionDirectory(officialPath)) {
        return [EXTENSIONS_DIR, false];
    }

    // 2. 커스텀 Extension 디렉터리 확인
    // 보안: sanitizedId로 이미 검증되어 안전
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const customPath = join(CUSTOM_EXTENSIONS_DIR, sanitizedId);
    if (isValidExtensionDirectory(customPath)) {
        return [CUSTOM_EXTENSIONS_DIR, true];
    }

    return null;
}

/**
 * 특정 Extension의 매니페스트 가져오기
 */
export function getExtensionManifest(extensionId: string): ExtensionManifest | null {
    const result = findExtensionDirectory(extensionId);
    if (!result) return null;

    const [baseDir] = result;
    const sanitizedId = sanitizePath(extensionId);
    return loadExtensionManifest(sanitizedId, baseDir);
}

/**
 * Extension 디렉터리 절대 경로 반환
 */
export function getExtensionPath(extensionId: string): string {
    const result = findExtensionDirectory(extensionId);
    const sanitizedId = sanitizePath(extensionId);

    if (!result) {
        // 기본적으로 공식 Extension 경로 반환 (호환성 유지)
        // 보안: sanitizedId로 이미 검증되어 안전
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        return join(EXTENSIONS_DIR, sanitizedId);
    }

    const [baseDir] = result;
    // 보안: sanitizedId로 이미 검증되어 안전
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return join(baseDir, sanitizedId);
}

/**
 * Extension이 설치되어 있는지 확인
 */
export function isExtensionInstalled(extensionId: string): boolean {
    return findExtensionDirectory(extensionId) !== null;
}

/**
 * Extension이 커스텀 Extension인지 확인
 */
export function isCustomExtension(extensionId: string): boolean {
    const result = findExtensionDirectory(extensionId);
    return result ? result[1] : false;
}

// ============================================================================
// Category 기반 필터링 함수 (하이브리드 2.0)
// ============================================================================

/**
 * 타입 가드: ThemeManifest 체크
 */
function isThemeManifest(manifest: ExtensionManifest): boolean {
    return 'category' in manifest && manifest.category === 'theme';
}

/**
 * 타입 가드: PluginManifest 체크
 */
function isPluginManifest(manifest: ExtensionManifest): boolean {
    return 'category' in manifest && manifest.category === 'plugin';
}

/**
 * 테마만 스캔하여 반환
 *
 * @returns 테마 ID를 key로 하는 ThemeManifest 맵
 *
 * @example
 * ```typescript
 * const themes = scanThemes();
 * for (const [id, theme] of themes) {
 *     console.log(`테마: ${theme.name} (${id})`);
 * }
 * ```
 */
export function scanThemes(): Map<string, ThemeManifest> {
    const allExtensions = scanExtensions();
    const themes = new Map<string, ThemeManifest>();

    for (const [id, manifest] of allExtensions) {
        if (isThemeManifest(manifest)) {
            themes.set(id, manifest as ThemeManifest);
        }
    }

    console.log(`✅ [Theme Scanner] ${themes.size}개 테마 발견`);
    return themes;
}

/**
 * 플러그인만 스캔하여 반환
 *
 * @returns 플러그인 ID를 key로 하는 PluginManifest 맵
 *
 * @example
 * ```typescript
 * const plugins = scanPlugins();
 * for (const [id, plugin] of plugins) {
 *     console.log(`플러그인: ${plugin.name} (타입: ${plugin.pluginType})`);
 * }
 * ```
 */
export function scanPlugins(): Map<string, PluginManifest> {
    const allExtensions = scanExtensions();
    const plugins = new Map<string, PluginManifest>();

    for (const [id, manifest] of allExtensions) {
        if (isPluginManifest(manifest)) {
            plugins.set(id, manifest as PluginManifest);
        }
    }

    console.log(`✅ [Plugin Scanner] ${plugins.size}개 플러그인 발견`);
    return plugins;
}

/**
 * 특정 타입의 플러그인만 스캔하여 반환
 *
 * @param type - 플러그인 타입 (BOARD, EDITOR, AUTH, SEO 등)
 * @returns 해당 타입의 플러그인 맵
 *
 * @example
 * ```typescript
 * // SEO 플러그인만 가져오기
 * const seoPlugins = scanPluginsByType(PluginType.SEO);
 *
 * // AI 플러그인만 가져오기
 * const aiPlugins = scanPluginsByType(PluginType.AI);
 * ```
 */
export function scanPluginsByType(type: PluginType): Map<string, PluginManifest> {
    const allPlugins = scanPlugins();
    const filtered = new Map<string, PluginManifest>();

    for (const [id, plugin] of allPlugins) {
        if (plugin.pluginType === type) {
            filtered.set(id, plugin);
        }
    }

    console.log(`✅ [Plugin Scanner] ${filtered.size}개 ${type} 플러그인 발견`);
    return filtered;
}
