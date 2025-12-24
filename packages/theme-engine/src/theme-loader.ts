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
	 * 테마 매니페스트 로드
	 */
	async loadManifest(themeId: string): Promise<ThemeManifest> {
		const manifestUrl = `${this.baseUrl}/${themeId}/theme.json`;

		try {
			const response = await fetch(manifestUrl);
			if (!response.ok) {
				throw new Error(`Failed to load theme manifest: ${response.statusText}`);
			}

			const manifest = await response.json();
			this.validateManifest(manifest);
			return manifest;
		} catch (error) {
			console.error(`Error loading theme manifest for "${themeId}":`, error);
			throw error;
		}
	}

	/**
	 * 테마 컴포넌트 동적 로드 (Vite import)
	 */
	async loadComponent(themeId: string, componentPath: string): Promise<any> {
		const fullPath = `${this.baseUrl}/${themeId}/${componentPath}`;

		try {
			// Vite의 동적 import 사용
			const module = await import(/* @vite-ignore */ fullPath);
			return module.default;
		} catch (error) {
			console.error(`Error loading component "${componentPath}" from theme "${themeId}":`, error);
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
		return `${this.baseUrl}/${themeId}`;
	}

	/**
	 * 테마 에셋 URL 가져오기
	 */
	getAssetUrl(themeId: string, assetPath: string): string {
		return `${this.baseUrl}/${themeId}/${assetPath}`;
	}
}
