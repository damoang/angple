import { hooks } from '@angple/hook-system';
import type { Component, Snippet } from 'svelte';
import type { ActiveTheme } from '$lib/data/mock-active-theme';
import { fetchActiveTheme } from '$lib/data/mock-active-theme';
import { getLayout, loadThemeStyles, removeThemeStyles } from '$lib/utils/theme-loader';
import DefaultLayout from '$lib/layouts/default-layout.svelte';

/**
 * 레이아웃 컴포넌트 Props 타입
 */
type LayoutProps = {
	children: Snippet;
};

/**
 * Web 앱 테마 상태 관리 스토어
 *
 * WordPress 스타일의 완전 테마 교체 시스템:
 * - 활성화된 테마 조회 및 캐싱
 * - Hook 자동 등록
 * - 테마 레이아웃 동적 로딩
 */
class ThemeStore {
	/** 현재 활성화된 테마 */
	activeTheme = $state<ActiveTheme | null>(null);

	/** 현재 사용 중인 레이아웃 컴포넌트 */
	layoutComponent = $state<Component<LayoutProps>>(DefaultLayout);

	/** 로딩 상태 */
	isLoading = $state(false);

	/** 에러 상태 */
	error = $state<string | null>(null);

	/** 테마 초기화 완료 여부 */
	isInitialized = $state(false);

	/** 폴링 인터벌 ID */
	private pollingInterval: ReturnType<typeof setInterval> | null = null;

	/** 폴링 주기 (밀리초) */
	private readonly POLLING_INTERVAL = 5000; // 5초

	/**
	 * 활성화된 테마 로드 및 Hook 등록
	 */
	async loadActiveTheme() {
		if (this.isLoading) return;

		this.isLoading = true;
		this.error = null;

		try {
			console.log('🎨 테마 시스템 초기화 중...');

			// 활성화된 테마 조회
			const theme = await fetchActiveTheme();

			if (!theme) {
				console.log('📦 활성화된 테마 없음 - 기본 레이아웃 사용');
				this.activeTheme = null;
				this.layoutComponent = DefaultLayout;
				removeThemeStyles();
				this.isInitialized = true;
				return;
			}

			this.activeTheme = theme;
			console.log('✅ 테마 로드 완료:', theme.manifest.name);

			// 레이아웃 컴포넌트 로드
			const layout = await getLayout(theme.manifest.id);
			this.layoutComponent = layout;

			// 테마 스타일 로드
			if (typeof window !== 'undefined') {
				await loadThemeStyles(theme.manifest.id);
			}

			// Hook 자동 등록
			await this.registerThemeHooks(theme);

			this.isInitialized = true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : '테마 로드 실패';
			console.error('❌ 테마 로드 에러:', err);
			// 에러 발생 시에도 기본 레이아웃 사용 가능하도록
			this.activeTheme = null;
			this.layoutComponent = DefaultLayout;
			removeThemeStyles();
			this.isInitialized = true;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 테마의 Hook을 자동으로 등록
	 * (현재는 Mock - Phase 5에서 실제 동적 로딩 구현)
	 */
	private async registerThemeHooks(theme: ActiveTheme) {
		if (!theme.manifest.hooks || theme.manifest.hooks.length === 0) {
			console.log('📋 등록할 Hook 없음');
			return;
		}

		console.log(`🎯 ${theme.manifest.hooks.length}개 Hook 등록 중...`);

		for (const hookDef of theme.manifest.hooks) {
			try {
				// TODO Phase 5: 실제 테마 파일에서 동적으로 로드
				// const hookFn = await import(`/themes/${theme.manifest.id}/${hookDef.callback}`);

				// Mock: 테마별로 다른 Hook 함수 시뮬레이션
				if (hookDef.type === 'action') {
					if (hookDef.name === 'page_loaded') {
						hooks.addAction(
							hookDef.name,
							() => {
								console.log(`✅ [${theme.manifest.name}] 페이지 로드 완료`);
							},
							hookDef.priority || 10
						);
					}
				} else if (hookDef.type === 'filter') {
					if (hookDef.name === 'post_title' || hookDef.name === 'page_title') {
						hooks.addFilter(
							hookDef.name,
							(title: string) => {
								return `[${theme.manifest.name}] ${title}`;
							},
							hookDef.priority || 10
						);
					}
				}

				console.log(`  ✓ Hook 등록: ${hookDef.type}:${hookDef.name}`);
			} catch (err) {
				console.error(`  ✗ Hook 등록 실패: ${hookDef.name}`, err);
			}
		}

		// page_loaded Action 실행
		hooks.doAction('page_loaded');

		// page_title Filter 적용
		if (typeof document !== 'undefined') {
			const originalTitle = document.title;
			const filteredTitle = hooks.applyFilters('page_title', originalTitle);
			document.title = filteredTitle;
		}
	}

	/**
	 * 테마 재로드
	 */
	async reloadTheme() {
		this.isInitialized = false;
		await this.loadActiveTheme();
	}

	/**
	 * 테마 설정값 업데이트
	 */
	updateSettings(settings: Record<string, any>) {
		if (!this.activeTheme) return;
		this.activeTheme.currentSettings = settings;
	}

	/**
	 * 테마 변경 감지 폴링 시작
	 * Admin에서 테마를 변경하면 자동으로 감지하여 리로드
	 */
	startPolling() {
		if (this.pollingInterval) return; // 이미 실행 중
		if (typeof window === 'undefined') return; // SSR 환경에서는 실행 안 함

		console.log('🔄 테마 변경 감지 폴링 시작 (5초 주기)');

		this.pollingInterval = setInterval(async () => {
			await this.checkThemeChange();
		}, this.POLLING_INTERVAL);
	}

	/**
	 * 폴링 중지
	 */
	stopPolling() {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
			console.log('⏹️ 테마 변경 감지 폴링 중지');
		}
	}

	/**
	 * 테마 변경 확인
	 */
	private async checkThemeChange() {
		try {
			const theme = await fetchActiveTheme();
			const newThemeId = theme?.manifest.id || null;
			const currentThemeId = this.activeTheme?.manifest.id || null;

			// 테마가 변경되었는지 확인
			if (newThemeId !== currentThemeId) {
				console.log(`🔁 테마 변경 감지: ${currentThemeId} → ${newThemeId}`);
				await this.reloadTheme();
				console.log('✅ 테마 자동 리로드 완료');
			}
		} catch (error) {
			console.error('테마 변경 확인 에러:', error);
		}
	}
}

/**
 * 전역 테마 스토어 인스턴스
 */
export const themeStore = new ThemeStore();
