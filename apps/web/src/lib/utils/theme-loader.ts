import type { Component, Snippet } from 'svelte';
import DefaultLayout from '$lib/layouts/default-layout.svelte';

/**
 * 테마 레이아웃 동적 로더
 *
 * WordPress 스타일: 테마가 전체 레이아웃을 교체할 수 있음
 * - Vite의 동적 import 기능 활용
 * - 에러 발생 시 기본 레이아웃으로 fallback
 */

/**
 * 레이아웃 컴포넌트가 받는 Props 타입
 */
type LayoutProps = {
	children: Snippet;
};

/**
 * 테마 레이아웃 컴포넌트 로드
 *
 * @param themeId - 테마 ID (예: 'sample-theme')
 * @returns Svelte 컴포넌트 또는 null
 */
export async function loadThemeLayout(themeId: string): Promise<Component<LayoutProps> | null> {
	try {
		console.log(`🎨 테마 레이아웃 로드 시도: ${themeId}`);

		// Vite 동적 import를 사용하여 테마 레이아웃 로드
		// Phase 5: 실제 구현 시 활성화
		// const module = await import(`/themes/${themeId}/layouts/main-layout.svelte`);
		// return module.default;

		// 현재는 Mock - Sample Theme만 지원
		if (themeId === 'sample-theme') {
			// Sample Theme 레이아웃 동적 import
			const module = await import('$lib/themes/sample-theme/layouts/main-layout.svelte');
			console.log('✅ Sample Theme 레이아웃 로드 완료');
			return module.default;
		}

		console.warn(`⚠️ 지원하지 않는 테마: ${themeId}`);
		return null;
	} catch (error) {
		console.error(`❌ 테마 레이아웃 로드 실패: ${themeId}`, error);
		return null;
	}
}

/**
 * 테마 레이아웃 또는 기본 레이아웃 반환
 *
 * @param themeId - 테마 ID (없으면 기본 레이아웃)
 * @returns Svelte 컴포넌트
 */
export async function getLayout(themeId: string | null): Promise<Component<LayoutProps>> {
	if (!themeId) {
		console.log('📦 테마 없음 - 기본 레이아웃 사용');
		return DefaultLayout;
	}

	const themeLayout = await loadThemeLayout(themeId);

	if (themeLayout) {
		return themeLayout;
	}

	console.log('📦 Fallback - 기본 레이아웃 사용');
	return DefaultLayout;
}

/**
 * 테마 CSS 동적 로드
 *
 * @param themeId - 테마 ID
 */
export async function loadThemeStyles(themeId: string): Promise<void> {
	try {
		// 기존 테마 스타일 제거
		const existingStyle = document.querySelector('link[data-theme-style]');
		if (existingStyle) {
			existingStyle.remove();
		}

		// 새 테마 스타일 추가
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = `/themes/${themeId}/styles/theme.css`;
		link.setAttribute('data-theme-style', themeId);

		document.head.appendChild(link);

		console.log(`✅ 테마 스타일 로드: ${themeId}`);
	} catch (error) {
		console.error(`❌ 테마 스타일 로드 실패: ${themeId}`, error);
	}
}

/**
 * 테마 스타일 제거
 */
export function removeThemeStyles(): void {
	const themeStyle = document.querySelector('link[data-theme-style]');
	if (themeStyle) {
		themeStyle.remove();
		console.log('✅ 테마 스타일 제거 완료');
	}
}
