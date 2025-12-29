/**
 * 테마 로더 - 테마 파일 동적 로딩
 */

import type { ThemeManifest, ActiveTheme } from '@angple/types';

export class ThemeLoader {
    private baseUrl: string;

    constructor(baseUrl: string = '/themes') {
        this.baseUrl = baseUrl;
    }

    /**
     * 경로 탐색 공격 방지를 위한 입력값 검증
     */
    private sanitizePath(path: string): string {
        // 경로 탐색 문자 제거 (../, ..\, 절대 경로 등)
        if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
            throw new Error('Invalid path: path traversal detected');
        }

        // 알파벳, 숫자, 하이픈, 언더스코어, 슬래시, 점만 허용
        if (!/^[a-zA-Z0-9\-_/.]+$/.test(path)) {
            throw new Error('Invalid path: contains illegal characters');
        }

        return path;
    }

    /**
     * 테마 매니페스트 로드
     */
    async loadManifest(themeId: string): Promise<ThemeManifest> {
        const sanitizedThemeId = this.sanitizePath(themeId);
        const manifestUrl = `${this.baseUrl}/${sanitizedThemeId}/theme.json`;

        try {
            const response = await fetch(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load theme manifest: ${response.statusText}`);
            }

            const manifest = await response.json();
            this.validateManifest(manifest);
            return manifest;
        } catch (error) {
            console.error('Error loading theme manifest:', { themeId, error });
            throw error;
        }
    }

    /**
     * 테마 컴포넌트 동적 로드 (Vite import)
     */
    async loadComponent(themeId: string, componentPath: string): Promise<any> {
        const sanitizedThemeId = this.sanitizePath(themeId);
        const sanitizedComponentPath = this.sanitizePath(componentPath);
        const fullPath = `${this.baseUrl}/${sanitizedThemeId}/${sanitizedComponentPath}`;

        try {
            // Vite의 동적 import 사용
            const module = await import(/* @vite-ignore */ fullPath);
            return module.default;
        } catch (error) {
            console.error('Error loading component:', { themeId, componentPath, error });
            throw error;
        }
    }

    /**
     * 매니페스트 유효성 검증
     */
    private validateManifest(manifest: any): asserts manifest is ThemeManifest {
        const required = ['id', 'name', 'version', 'author'];
        const missing = required.filter((field) => !manifest[field]);

        if (missing.length > 0) {
            throw new Error(`Invalid theme manifest: missing fields ${missing.join(', ')}`);
        }

        // 버전 형식 검증 (semver)
        if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
            throw new Error(`Invalid version format: ${manifest.version}`);
        }
    }

    /**
     * 테마 디렉터리 경로 가져오기
     */
    getThemePath(themeId: string): string {
        const sanitizedThemeId = this.sanitizePath(themeId);
        return `${this.baseUrl}/${sanitizedThemeId}`;
    }

    /**
     * 테마 에셋 URL 가져오기
     */
    getAssetUrl(themeId: string, assetPath: string): string {
        const sanitizedThemeId = this.sanitizePath(themeId);
        const sanitizedAssetPath = this.sanitizePath(assetPath);
        return `${this.baseUrl}/${sanitizedThemeId}/${sanitizedAssetPath}`;
    }
}
