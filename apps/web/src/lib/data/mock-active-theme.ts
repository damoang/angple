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
 * 활성화된 테마 가져오기 (실제 API 호출)
 */
export async function fetchActiveTheme(): Promise<ActiveTheme | null> {
	try {
		const response = await fetch('/api/themes/active');
		if (!response.ok) {
			console.error('활성 테마 조회 실패:', response.status);
			return null;
		}

		const data = await response.json();
		const themeId = data.activeTheme;

		if (!themeId) {
			return null;
		}

		// 현재는 themeId만 받아서 Mock 매니페스트 사용
		// TODO: 실제로는 테마 매니페스트도 API에서 가져와야 함
		if (themeId === 'sample-theme') {
			return mockActiveTheme;
		}

		// 다른 테마는 기본 구조만 반환
		return {
			manifest: {
				id: themeId,
				name: themeId,
				version: '1.0.0',
				author: { name: 'Unknown', email: '' },
				description: '',
				angpleVersion: '0.1.0',
				tags: []
			},
			activatedAt: new Date(),
			currentSettings: {}
		};
	} catch (error) {
		console.error('테마 API 호출 에러:', error);
		return null;
	}
}
