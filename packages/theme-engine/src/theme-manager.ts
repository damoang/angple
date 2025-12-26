/**
 * 테마 매니저 - 테마 활성화/비활성화 및 상태 관리
 */

import type { ThemeManifest, ActiveTheme, ComponentDefinition } from '@angple/types';
import { hooks } from '@angple/hook-system';
import { ThemeLoader } from './theme-loader.js';

export class ThemeManager {
	private loader: ThemeLoader;
	private activeTheme: ActiveTheme | null = null;
	private registeredComponents = new Map<string, any>();

	constructor(baseUrl?: string) {
		this.loader = new ThemeLoader(baseUrl);
	}

	/**
	 * 테마 활성화
	 */
	async activateTheme(themeId: string, settings: Record<string, any> = {}): Promise<void> {
		// 기존 테마 비활성화
		if (this.activeTheme) {
			await this.deactivateTheme();
		}

		try {
			// 매니페스트 로드
			const manifest = await this.loader.loadManifest(themeId);

			// Hook 등록
			if (manifest.hooks) {
				await this.registerHooks(themeId, manifest.hooks);
			}

			// 컴포넌트 로드 및 등록
			if (manifest.components) {
				await this.registerComponents(themeId, manifest.components);
			}

			// Active Theme 설정
			this.activeTheme = {
				manifest,
				path: this.loader.getThemePath(themeId),
				settings: { ...this.getDefaultSettings(manifest), ...settings },
				activatedAt: new Date()
			};

			// theme_activated Hook 실행
			hooks.doAction('theme_activated', themeId);

			console.log(`✅ Theme "${manifest.name}" activated`);
		} catch (error) {
			console.error(`Failed to activate theme "${themeId}":`, error);
			throw error;
		}
	}

	/**
	 * 테마 비활성화
	 */
	async deactivateTheme(): Promise<void> {
		if (!this.activeTheme) {
			return;
		}

		const themeId = this.activeTheme.manifest.id;

		// Hook 제거
		if (this.activeTheme.manifest.hooks) {
			this.unregisterHooks(this.activeTheme.manifest.hooks);
		}

		// 컴포넌트 제거
		this.registeredComponents.clear();

		// theme_deactivated Hook 실행
		hooks.doAction('theme_deactivated', themeId);

		console.log(`✅ Theme "${this.activeTheme.manifest.name}" deactivated`);
		this.activeTheme = null;
	}

	/**
	 * Hook 등록
	 */
	private async registerHooks(themeId: string, hookDefs: any[]): Promise<void> {
		for (const hookDef of hookDefs) {
			try {
				// Hook 콜백 함수 로드
				const callbackModule = await this.loader.loadComponent(themeId, hookDef.callback);
				const callback = typeof callbackModule === 'function' ? callbackModule : callbackModule.default;

				if (hookDef.type === 'action') {
					hooks.addAction(hookDef.name, callback, hookDef.priority || 10);
				} else if (hookDef.type === 'filter') {
					hooks.addFilter(hookDef.name, callback, hookDef.priority || 10);
				}

				console.log(`✅ Registered ${hookDef.type} hook: ${hookDef.name}`);
			} catch (error) {
				console.error(`Failed to register hook "${hookDef.name}":`, error);
			}
		}
	}

	/**
	 * Hook 제거
	 */
	private unregisterHooks(hookDefs: any[]): void {
		// Note: hook-system에 removeAction/removeFilter 구현 필요
		// 현재는 로그만 출력
		console.log(`Unregistering ${hookDefs.length} hooks...`);
	}

	/**
	 * 컴포넌트 등록
	 */
	private async registerComponents(
		themeId: string,
		components: ComponentDefinition[]
	): Promise<void> {
		for (const comp of components) {
			try {
				const component = await this.loader.loadComponent(themeId, comp.path);
				this.registeredComponents.set(comp.id, {
					...comp,
					component
				});

				console.log(`✅ Registered component: ${comp.name} (slot: ${comp.slot})`);
			} catch (error) {
				console.error(`Failed to register component "${comp.name}":`, error);
			}
		}
	}

	/**
	 * 슬롯별 컴포넌트 가져오기
	 */
	getComponentsBySlot(slot: string): Array<{ definition: ComponentDefinition; component: any }> {
		const components: Array<{ definition: ComponentDefinition; component: any }> = [];

		this.registeredComponents.forEach((value) => {
			if (value.slot === slot) {
				components.push({
					definition: value,
					component: value.component
				});
			}
		});

		// 우선순위 순서대로 정렬
		components.sort((a, b) => (a.definition.priority || 10) - (b.definition.priority || 10));

		return components;
	}

	/**
	 * 활성 테마 정보 가져오기
	 */
	getActiveTheme(): ActiveTheme | null {
		return this.activeTheme;
	}

	/**
	 * 테마 설정 업데이트
	 */
	updateSettings(settings: Record<string, any>): void {
		if (!this.activeTheme) {
			throw new Error('No active theme');
		}

		this.activeTheme.settings = {
			...this.activeTheme.settings,
			...settings
		};

		console.log('✅ Theme settings updated');
	}

	/**
	 * 테마 설정 가져오기
	 */
	getSettings(): Record<string, any> {
		return this.activeTheme?.settings || {};
	}

	/**
	 * 기본 설정값 추출
	 */
	private getDefaultSettings(manifest: ThemeManifest): Record<string, any> {
		const defaults: Record<string, any> = {};

		if (manifest.settings) {
			Object.entries(manifest.settings).forEach(([group, fields]) => {
				Object.entries(fields).forEach(([key, field]) => {
					defaults[`${group}.${key}`] = field.default;
				});
			});
		}

		return defaults;
	}
}
