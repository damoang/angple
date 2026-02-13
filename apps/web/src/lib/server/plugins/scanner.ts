/**
 * 플러그인 스캔 및 로드 함수
 *
 * plugins/ 및 custom-plugins/ 디렉터리를 스캔하여 설치된 플러그인 목록을 가져옵니다.
 * 테마 스캐너(scanner.ts)와 동일한 패턴으로 구현되었습니다.
 *
 * ExtensionManifest 스키마 사용:
 * - plugin.json 또는 extension.json 파일 모두 지원
 * - Zod 런타임 검증으로 타입 안전성 보장
 * - category 필드로 테마/플러그인 구분
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { ExtensionManifest } from '@angple/types';
import { safeValidateExtensionManifest } from '@angple/types';
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

/** 공식 플러그인 디렉터리 경로 (Git 추적) */
const PLUGINS_DIR = join(PROJECT_ROOT, 'plugins');

/** 커스텀 플러그인 디렉터리 경로 (Git 무시, 사용자 업로드) */
const CUSTOM_PLUGINS_DIR = join(PROJECT_ROOT, 'custom-plugins');

/** GitHub Packages에서 설치된 확장 디렉터리 */
const CUSTOM_EXTENSIONS_DIR = join(PROJECT_ROOT, 'custom-extensions');

/**
 * 플러그인 디렉터리가 유효한지 확인
 *
 * plugin.json 또는 extension.json 파일이 있으면 유효한 플러그인으로 간주
 */
function isValidPluginDirectory(pluginPath: string): boolean {
    if (!existsSync(pluginPath)) return false;

    const stat = statSync(pluginPath);
    if (!stat.isDirectory()) return false;

    // plugin.json 또는 extension.json 파일 존재 확인
    const pluginJsonPath = join(pluginPath, 'plugin.json'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const extensionJsonPath = join(pluginPath, 'extension.json'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

    return existsSync(pluginJsonPath) || existsSync(extensionJsonPath);
}

/**
 * plugin.json 또는 extension.json 파일을 읽고 검증
 *
 * @param pluginDir 플러그인 디렉터리명 (안전한 이름, readdir에서 반환)
 * @param baseDir 플러그인이 위치한 기본 디렉터리 (PLUGINS_DIR 또는 CUSTOM_PLUGINS_DIR)
 * @returns ExtensionManifest 또는 null (category가 'plugin'이 아니거나 검증 실패 시)
 */
function loadPluginManifest(pluginDir: string, baseDir: string): ExtensionManifest | null {
    // pluginDir는 readdir()에서 온 안전한 디렉터리명
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const pluginJsonPath = join(baseDir, pluginDir, 'plugin.json');
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const extensionJsonPath = join(baseDir, pluginDir, 'extension.json');

    // plugin.json 우선, 없으면 extension.json 시도
    let manifestPath: string;
    if (existsSync(pluginJsonPath)) {
        manifestPath = pluginJsonPath;
    } else if (existsSync(extensionJsonPath)) {
        manifestPath = extensionJsonPath;
    } else {
        console.warn(`⚠️  [Plugin Scanner] 매니페스트 파일 없음: ${pluginDir}`);
        return null;
    }

    try {
        const manifestJson = readFileSync(manifestPath, 'utf-8');
        const manifestData = JSON.parse(manifestJson);

        // 기본값 제공 (기존 플러그인 호환성)
        const normalizedData = {
            ...manifestData,
            // category가 없으면 'plugin'으로 간주 (plugin.json 파일이므로)
            category: manifestData.category || 'plugin',
            // license가 없으면 'UNLICENSED'로 설정
            license: manifestData.license || 'UNLICENSED'
        };

        // ExtensionManifest Zod 검증
        const result = safeValidateExtensionManifest(normalizedData);

        if (!result.success) {
            console.error('❌ [Plugin Scanner] 매니페스트 검증 실패:', { pluginDir });
            console.error(result.error.issues);
            return null;
        }

        // category가 'plugin'인 것만 반환 (테마는 제외)
        if (result.data.category !== 'plugin') {
            console.warn(
                `⚠️  [Plugin Scanner] 플러그인 아님 (category: ${result.data.category}): ${pluginDir}`
            );
            return null;
        }

        return result.data;
    } catch (error) {
        console.error('❌ [Plugin Scanner] 플러그인 매니페스트 로드 실패:', { pluginDir, error });
        return null;
    }
}

/**
 * 특정 디렉터리에서 플러그인 스캔 헬퍼
 */
function scanDirectory(baseDir: string, plugins: Map<string, ExtensionManifest>): number {
    if (!existsSync(baseDir)) {
        return 0;
    }

    let scannedCount = 0;
    const entries = readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
        // 디렉터리만 처리
        if (!entry.isDirectory()) continue;

        const pluginDir = entry.name;
        // pluginDir는 readdirSync()에서 반환된 실제 디렉터리명 (사용자 입력 아님)
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const pluginPath = join(baseDir, pluginDir);

        // 유효한 플러그인 디렉터리인지 확인
        if (!isValidPluginDirectory(pluginPath)) {
            console.warn(`⚠️  [Plugin Scanner] 유효하지 않은 플러그인: ${pluginDir}`);
            continue;
        }

        // 매니페스트 로드 및 검증
        const manifest = loadPluginManifest(pluginDir, baseDir);
        if (!manifest) continue;

        // 디렉터리 이름과 ID가 일치하는지 확인
        if (manifest.id !== pluginDir) {
            console.warn(
                `⚠️  [Plugin Scanner] 플러그인 ID 불일치: 디렉터리명=${pluginDir}, manifest.id=${manifest.id}`
            );
            console.warn('   디렉터리 이름을 플러그인 ID로 사용합니다.');
        }

        plugins.set(manifest.id, manifest);
        scannedCount++;
    }

    return scannedCount;
}

/**
 * plugins/ 및 custom-plugins/ 디렉터리를 스캔하여 모든 플러그인 매니페스트 반환
 *
 * ExtensionManifest를 사용하며, category가 'plugin'인 것만 반환합니다.
 *
 * @returns 플러그인 ID를 key로 하는 ExtensionManifest 맵
 */
export function scanPlugins(): Map<string, ExtensionManifest> {
    const plugins = new Map<string, ExtensionManifest>();

    try {
        // 공식 플러그인 스캔 (Git 추적)
        const officialCount = scanDirectory(PLUGINS_DIR, plugins);

        // 커스텀 플러그인 스캔 (사용자 업로드)
        const customCount = scanDirectory(CUSTOM_PLUGINS_DIR, plugins);

        // GitHub Packages에서 설치된 확장 스캔
        const extensionCount = scanDirectory(CUSTOM_EXTENSIONS_DIR, plugins);

        console.log(
            `✅ [Plugin Scanner] 총 ${plugins.size}개 플러그인 스캔 완료 (공식: ${officialCount}, 커스텀: ${customCount}, 확장: ${extensionCount})`
        );
    } catch (error) {
        console.error('❌ [Plugin Scanner] 플러그인 스캔 실패:', error);
    }

    return plugins;
}

/**
 * 플러그인이 어느 디렉터리에 있는지 찾기
 * @returns [baseDir, isCustom] 튜플 또는 null
 */
function findPluginDirectory(pluginId: string): [string, boolean] | null {
    const sanitizedId = sanitizePath(pluginId);

    // 1. 공식 플러그인 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const officialPath = join(PLUGINS_DIR, sanitizedId);
    if (isValidPluginDirectory(officialPath)) {
        return [PLUGINS_DIR, false];
    }

    // 2. 커스텀 플러그인 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const customPath = join(CUSTOM_PLUGINS_DIR, sanitizedId);
    if (isValidPluginDirectory(customPath)) {
        return [CUSTOM_PLUGINS_DIR, true];
    }

    // 3. GitHub Packages에서 설치된 확장 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const extensionPath = join(CUSTOM_EXTENSIONS_DIR, sanitizedId);
    if (isValidPluginDirectory(extensionPath)) {
        return [CUSTOM_EXTENSIONS_DIR, true];
    }

    return null;
}

/**
 * 특정 플러그인의 매니페스트 가져오기
 */
export function getPluginManifest(pluginId: string): ExtensionManifest | null {
    const result = findPluginDirectory(pluginId);
    if (!result) return null;

    const [baseDir] = result;
    const sanitizedId = sanitizePath(pluginId);
    return loadPluginManifest(sanitizedId, baseDir);
}

/**
 * 플러그인 디렉터리 절대 경로 반환
 */
export function getPluginPath(pluginId: string): string {
    const result = findPluginDirectory(pluginId);
    const sanitizedId = sanitizePath(pluginId);

    if (!result) {
        // 기본적으로 공식 플러그인 경로 반환 (호환성 유지)
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        return join(PLUGINS_DIR, sanitizedId);
    }

    const [baseDir] = result;
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return join(baseDir, sanitizedId);
}

/**
 * 플러그인이 설치되어 있는지 확인
 */
export function isPluginInstalled(pluginId: string): boolean {
    return findPluginDirectory(pluginId) !== null;
}

/**
 * 플러그인이 커스텀 플러그인인지 확인
 */
export function isCustomPlugin(pluginId: string): boolean {
    const result = findPluginDirectory(pluginId);
    return result ? result[1] : false;
}

/**
 * 플러그인 디렉터리 경로 반환 (파일 서빙용)
 */
export function getPluginsDirs(): { official: string; custom: string; extensions: string } {
    return {
        official: PLUGINS_DIR,
        custom: CUSTOM_PLUGINS_DIR,
        extensions: CUSTOM_EXTENSIONS_DIR
    };
}
