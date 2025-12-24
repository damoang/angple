import type { ThemeManifest } from '@angple/types';

/**
 * Mock 활성화된 테마 데이터
 * Phase 3 개발 중 실제 API 없이 테마 시스템 테스트용
 */
export interface ActiveTheme {
	manifest: ThemeManifest;
	activatedAt: Date;
	currentSettings: Record<string, any>;
}

/**
 * 현재 활성화된 테마 (Sample Theme)
 */
export const mockActiveTheme: ActiveTheme = {
	manifest: {
		id: 'sample-theme',
		name: 'Sample Theme',
		version: '1.0.0',
		author: {
			name: 'Angple Team',
			email: 'team@angple.com'
		},
		description: '테마 시스템 테스트용 샘플 테마입니다. 기본 Hook과 컴포넌트를 포함합니다.',
		screenshot: '/themes/sample-theme/screenshot.png',
		hooks: [
			{
				name: 'page_loaded',
				type: 'action',
				callback: 'hooks/on-page-load.js',
				priority: 15
			},
			{
				name: 'post_title',
				type: 'filter',
				callback: 'hooks/filter-post-title.js',
				priority: 10
			}
		],
		components: [
			{
				id: 'custom-banner',
				name: 'Custom Banner',
				slot: 'content-before',
				path: 'components/banner.svelte',
				priority: 5
			}
		],
		settings: {
			appearance: {
				primaryColor: {
					label: 'Primary Color',
					type: 'color',
					default: '#3b82f6'
				},
				showBanner: {
					label: 'Show Banner',
					type: 'boolean',
					default: true
				}
			}
		},
		angpleVersion: '0.1.0',
		tags: ['sample', 'test', 'basic']
	},
	activatedAt: new Date('2024-12-20'),
	currentSettings: {
		appearance: {
			primaryColor: '#3b82f6',
			showBanner: true
		}
	}
};

/**
 * 활성화된 테마 가져오기 (API 시뮬레이션)
 */
export async function fetchActiveTheme(): Promise<ActiveTheme | null> {
	// Mock API 호출 시뮬레이션 (300ms 지연)
	await new Promise((resolve) => setTimeout(resolve, 300));

	// localStorage에서 Mock 모드 확인
	const useMock =
		typeof window !== 'undefined' &&
		window.localStorage.getItem('damoang_use_mock') !== 'false';

	if (!useMock) {
		// 실제 API 호출 (Phase 4에서 구현)
		console.warn('⚠️ 실제 API 미구현 - Mock 데이터 반환');
	}

	return mockActiveTheme;
}
