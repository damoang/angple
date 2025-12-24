import { mockThemes } from '$lib/data';
import type { ThemeWithStatus, ThemeAction } from '$lib/types';
import { toast } from 'svelte-sonner';

/**
 * 테마 관리 Store (Svelte 5 Rune 모드)
 *
 * Mock 데이터 기반으로 테마 목록, 활성화/비활성화 등을 관리합니다.
 * Phase 4에서 실제 API로 교체될 예정입니다.
 */
class ThemeStore {
	/** 테마 목록 */
	themes = $state<ThemeWithStatus[]>(mockThemes);

	/** 로딩 상태 */
	isLoading = $state(false);

	/** 현재 진행 중인 액션 */
	currentAction = $state<{ themeId: string; action: ThemeAction } | null>(null);

	/**
	 * 활성화된 테마 가져오기
	 */
	get activeTheme() {
		return this.themes.find((theme) => theme.status === 'active');
	}

	/**
	 * 테마 ID로 찾기
	 */
	getThemeById(themeId: string): ThemeWithStatus | undefined {
		return this.themes.find((theme) => theme.manifest.id === themeId);
	}

	/**
	 * 테마 활성화
	 * - 기존 활성화된 테마는 비활성화
	 * - 선택한 테마를 활성화
	 */
	async activateTheme(themeId: string) {
		this.isLoading = true;
		this.currentAction = { themeId, action: 'activate' };

		try {
			// Mock API 호출 시뮬레이션 (200ms 지연)
			await new Promise((resolve) => setTimeout(resolve, 200));

			// 기존 활성화된 테마 비활성화
			const currentActive = this.activeTheme;
			if (currentActive) {
				currentActive.status = 'inactive';
				currentActive.activatedAt = undefined;
			}

			// 새 테마 활성화
			const theme = this.getThemeById(themeId);
			if (theme) {
				theme.status = 'active';
				theme.activatedAt = new Date();
				toast.success(`${theme.manifest.name} 테마가 활성화되었습니다.`);
			}
		} catch (error) {
			console.error('테마 활성화 실패:', error);
			toast.error('테마 활성화에 실패했습니다.');
		} finally {
			this.isLoading = false;
			this.currentAction = null;
		}
	}

	/**
	 * 테마 비활성화
	 */
	async deactivateTheme(themeId: string) {
		this.isLoading = true;
		this.currentAction = { themeId, action: 'deactivate' };

		try {
			await new Promise((resolve) => setTimeout(resolve, 200));

			const theme = this.getThemeById(themeId);
			if (theme) {
				theme.status = 'inactive';
				theme.activatedAt = undefined;
				toast.success(`${theme.manifest.name} 테마가 비활성화되었습니다.`);
			}
		} catch (error) {
			console.error('테마 비활성화 실패:', error);
			toast.error('테마 비활성화에 실패했습니다.');
		} finally {
			this.isLoading = false;
			this.currentAction = null;
		}
	}

	/**
	 * 테마 삭제
	 */
	async deleteTheme(themeId: string) {
		this.isLoading = true;
		this.currentAction = { themeId, action: 'delete' };

		try {
			await new Promise((resolve) => setTimeout(resolve, 300));

			const index = this.themes.findIndex((theme) => theme.manifest.id === themeId);
			if (index !== -1) {
				const themeName = this.themes[index].manifest.name;
				this.themes.splice(index, 1);
				toast.success(`${themeName} 테마가 삭제되었습니다.`);
			}
		} catch (error) {
			console.error('테마 삭제 실패:', error);
			toast.error('테마 삭제에 실패했습니다.');
		} finally {
			this.isLoading = false;
			this.currentAction = null;
		}
	}

	/**
	 * 테마 재설치 (에러 상태에서)
	 */
	async retryInstall(themeId: string) {
		this.isLoading = true;
		this.currentAction = { themeId, action: 'install' };

		try {
			await new Promise((resolve) => setTimeout(resolve, 500));

			const theme = this.getThemeById(themeId);
			if (theme) {
				// 랜덤으로 성공/실패 시뮬레이션
				const success = Math.random() > 0.3;

				if (success) {
					theme.status = 'inactive';
					theme.errorMessage = undefined;
					theme.installedAt = new Date();
					toast.success(`${theme.manifest.name} 테마가 설치되었습니다.`);
				} else {
					theme.errorMessage = '설치 중 오류가 발생했습니다. 네트워크를 확인해주세요.';
					toast.error(`${theme.manifest.name} 테마 설치에 실패했습니다.`);
				}
			}
		} catch (error) {
			console.error('테마 재설치 실패:', error);
			toast.error('테마 재설치에 실패했습니다.');
		} finally {
			this.isLoading = false;
			this.currentAction = null;
		}
	}

	/**
	 * 특정 액션이 진행 중인지 확인
	 */
	isActionInProgress(themeId: string, action: ThemeAction): boolean {
		return (
			this.currentAction !== null &&
			this.currentAction.themeId === themeId &&
			this.currentAction.action === action
		);
	}

	/**
	 * 테마가 로딩 중인지 확인
	 */
	isThemeLoading(themeId: string): boolean {
		return this.currentAction !== null && this.currentAction.themeId === themeId;
	}
}

/**
 * 전역 테마 Store 인스턴스
 */
export const themeStore = new ThemeStore();
