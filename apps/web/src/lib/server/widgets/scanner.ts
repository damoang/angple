/**
 * 위젯 스캔 및 로드 함수
 *
 * widgets/ 및 custom-widgets/ 디렉터리를 스캔하여 설치된 위젯 목록을 가져옵니다.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { WidgetManifest, WidgetInfo } from '$lib/types/widget-manifest';
import { safeValidateWidgetManifest } from '$lib/types/widget-manifest';
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

/** 공식 위젯 디렉터리 경로 (Git 추적) */
const WIDGETS_DIR = join(PROJECT_ROOT, 'widgets');

/** 커스텀 위젯 디렉터리 경로 (Git 무시, 사용자 업로드) */
const CUSTOM_WIDGETS_DIR = join(PROJECT_ROOT, 'custom-widgets');

/**
 * 위젯 디렉터리가 유효한지 확인
 */
function isValidWidgetDirectory(widgetPath: string): boolean {
    if (!existsSync(widgetPath)) return false;

    const stat = statSync(widgetPath);
    if (!stat.isDirectory()) return false;

    // widget.json 파일이 있어야 함
    const manifestPath = join(widgetPath, 'widget.json'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return existsSync(manifestPath);
}

/**
 * widget.json 파일을 읽고 검증
 * @param widgetDir 위젯 디렉터리명 (안전한 이름, readdir에서 반환)
 * @param baseDir 위젯이 위치한 기본 디렉터리 (WIDGETS_DIR 또는 CUSTOM_WIDGETS_DIR)
 */
function loadWidgetManifest(widgetDir: string, baseDir: string): WidgetManifest | null {
    // widgetDir는 readdir()에서 온 안전한 디렉터리명
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const manifestPath = join(baseDir, widgetDir, 'widget.json');

    try {
        const manifestJson = readFileSync(manifestPath, 'utf-8');
        const manifestData = JSON.parse(manifestJson);

        // Zod 검증
        const result = safeValidateWidgetManifest(manifestData);

        if (!result.success) {
            console.error('❌ [Widget Scanner] 위젯 검증 실패:', { widgetDir });
            console.error(result.error.issues);
            return null;
        }

        return result.data;
    } catch (error) {
        console.error('❌ [Widget Scanner] 위젯 매니페스트 로드 실패:', { widgetDir, error });
        return null;
    }
}

/**
 * 특정 디렉터리에서 위젯 스캔 헬퍼
 */
function scanDirectory(
    baseDir: string,
    widgets: Map<string, WidgetInfo>,
    isCustom: boolean
): number {
    if (!existsSync(baseDir)) {
        return 0;
    }

    let scannedCount = 0;
    const entries = readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
        // 디렉터리만 처리
        if (!entry.isDirectory()) continue;

        const widgetDir = entry.name;
        // widgetDir는 readdirSync()에서 반환된 실제 디렉터리명 (사용자 입력 아님)
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const widgetPath = join(baseDir, widgetDir);

        // 유효한 위젯 디렉터리인지 확인
        if (!isValidWidgetDirectory(widgetPath)) {
            console.warn(`⚠️  [Widget Scanner] 유효하지 않은 위젯: ${widgetDir}`);
            continue;
        }

        // 매니페스트 로드 및 검증
        const manifest = loadWidgetManifest(widgetDir, baseDir);
        if (!manifest) continue;

        // 디렉터리 이름과 ID가 일치하는지 확인
        if (manifest.id !== widgetDir) {
            console.warn(
                `⚠️  [Widget Scanner] 위젯 ID 불일치: 디렉터리명=${widgetDir}, manifest.id=${manifest.id}`
            );
            console.warn('   디렉터리 이름을 위젯 ID로 사용합니다.');
        }

        const widgetInfo: WidgetInfo = {
            ...manifest,
            path: widgetPath,
            isCustom
        };

        widgets.set(manifest.id, widgetInfo);
        scannedCount++;
    }

    return scannedCount;
}

/**
 * widgets/ 및 custom-widgets/ 디렉터리를 스캔하여 모든 위젯 매니페스트 반환
 *
 * @returns 위젯 ID를 key로 하는 WidgetInfo 맵
 */
export function scanWidgets(): Map<string, WidgetInfo> {
    const widgets = new Map<string, WidgetInfo>();

    try {
        // 공식 위젯 스캔 (Git 추적)
        const officialCount = scanDirectory(WIDGETS_DIR, widgets, false);

        // 커스텀 위젯 스캔 (사용자 업로드)
        const customCount = scanDirectory(CUSTOM_WIDGETS_DIR, widgets, true);

        console.log(
            `✅ [Widget Scanner] 총 ${widgets.size}개 위젯 스캔 완료 (공식: ${officialCount}, 커스텀: ${customCount})`
        );
    } catch (error) {
        console.error('❌ [Widget Scanner] 위젯 스캔 실패:', error);
    }

    return widgets;
}

/**
 * 위젯가 어느 디렉터리에 있는지 찾기
 * @returns [baseDir, isCustom] 튜플 또는 null
 */
function findWidgetDirectory(widgetId: string): [string, boolean] | null {
    const sanitizedId = sanitizePath(widgetId);

    // 1. 공식 위젯 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const officialPath = join(WIDGETS_DIR, sanitizedId);
    if (isValidWidgetDirectory(officialPath)) {
        return [WIDGETS_DIR, false];
    }

    // 2. 커스텀 위젯 디렉터리 확인
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const customPath = join(CUSTOM_WIDGETS_DIR, sanitizedId);
    if (isValidWidgetDirectory(customPath)) {
        return [CUSTOM_WIDGETS_DIR, true];
    }

    return null;
}

/**
 * 특정 위젯의 매니페스트 가져오기
 */
export function getWidgetManifest(widgetId: string): WidgetManifest | null {
    const result = findWidgetDirectory(widgetId);
    if (!result) return null;

    const [baseDir] = result;
    const sanitizedId = sanitizePath(widgetId);
    return loadWidgetManifest(sanitizedId, baseDir);
}

/**
 * 위젯 디렉터리 절대 경로 반환
 */
export function getWidgetPath(widgetId: string): string {
    const result = findWidgetDirectory(widgetId);
    const sanitizedId = sanitizePath(widgetId);

    if (!result) {
        // 기본적으로 공식 위젯 경로 반환 (호환성 유지)
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        return join(WIDGETS_DIR, sanitizedId);
    }

    const [baseDir] = result;
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return join(baseDir, sanitizedId);
}

/**
 * 위젯이 설치되어 있는지 확인
 */
export function isWidgetInstalled(widgetId: string): boolean {
    return findWidgetDirectory(widgetId) !== null;
}

/**
 * 위젯이 커스텀 위젯인지 확인
 */
export function isCustomWidget(widgetId: string): boolean {
    const result = findWidgetDirectory(widgetId);
    return result ? result[1] : false;
}

/**
 * 커스텀 위젯 디렉터리 경로 반환
 */
export function getCustomWidgetsDir(): string {
    return CUSTOM_WIDGETS_DIR;
}
